"use server";

import { revalidatePath } from "next/cache";
import { runHttpCase } from "@/lib/evalgate/adapters/http-endpoint";
import { httpsTransport } from "@/lib/evalgate/adapters/transport";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { evalRunFields, type EvalRun } from "@/lib/evalgate/evaluations";
import { isOperator } from "@/lib/evalgate/operator";
import { nextPendingCase, pacingWaitMs, summarizeRun, type StoredCaseResult } from "@/lib/evalgate/run-plan";
import { scoreEvaluationResult } from "@/lib/evalgate/scoring";
import { targetFields, targetToConfig, type Target } from "@/lib/evalgate/targets";
import type { TestCase } from "@/lib/evalgate/test-cases";
import { createClient } from "@/lib/supabase/server";

export type RunStep =
  | { kind: "wait"; ms: number }
  | { kind: "case"; testCaseName: string; status: "completed" | "error"; done: number; total: number }
  | { kind: "finished"; status: string }
  | { kind: "error"; message: string };

type CaseRow = Pick<TestCase, "id" | "name" | "input" | "expected_keywords" | "forbidden_keywords" | "category" | "priority">;
const caseFields = "id, name, input, expected_keywords, forbidden_keywords, category, priority";

async function finalizeRun(run: EvalRun): Promise<RunStep> {
  const supabase = createClient();
  const [{ data: rows, error: rowsError }, { data: caseData, error: caseError }] = await Promise.all([
    supabase.from("eval_results").select("test_case_id, result_status, passed, total_score, forbidden_found, response_output").eq("eval_run_id", run.id),
    supabase.from("test_cases").select(caseFields).eq("project_id", run.project_id).in("id", run.planned_test_case_ids),
  ]);
  if (rowsError || caseError) return { kind: "error", message: "Could not load results to finish the run." };

  const cases = new Map(((caseData ?? []) as CaseRow[]).map((testCase) => [testCase.id, testCase]));
  const stored: StoredCaseResult[] = ((rows ?? []) as Array<{ test_case_id: string; result_status: "completed" | "error"; passed: boolean; total_score: number; forbidden_found: boolean; response_output: string }>).map((row) => {
    const testCase = cases.get(row.test_case_id);
    // Keyword coverage is recomputed from the stored reply (deterministic) for the verdict.
    const matches = row.result_status === "completed" && testCase
      ? scoreEvaluationResult({ responseOutput: row.response_output, expectedKeywords: testCase.expected_keywords, forbiddenKeywords: testCase.forbidden_keywords, category: testCase.category, priority: testCase.priority, latencyMs: 0, estimatedCost: 0 }).keyword_matches
      : null;
    return {
      result_status: row.result_status,
      passed: row.passed,
      total_score: Number(row.total_score),
      forbidden_found: row.forbidden_found,
      expected_count: matches?.expected.length ?? 0,
      matched_count: matches?.matched.length ?? 0,
    };
  });

  const summary = summarizeRun(stored, run.planned_test_case_ids.length);
  const { data: updated, error: updateError } = await supabase
    .from("eval_runs")
    .update({
      status: summary.status,
      total_tests: summary.total_tests,
      passed_tests: summary.passed_tests,
      failed_tests: summary.failed_tests,
      errored_tests: summary.errored_tests,
      average_score: summary.average_score,
      safety_failures: summary.safety_failures,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("status", "running")
    .select("id");
  if (updateError) return { kind: "error", message: "Could not save the run summary." };

  // Only the call that actually closed the run writes the decision.
  if (summary.decision && (updated ?? []).length > 0) {
    await supabase.from("release_decisions").insert({
      project_id: run.project_id,
      eval_run_id: run.id,
      decision: summary.decision.decision,
      total_score: summary.decision.total_score,
      reason: summary.decision.reason,
    });
  }
  revalidatePath("/evaluations");
  revalidatePath("/results");
  revalidatePath("/reports");
  return { kind: "finished", status: summary.status };
}

/**
 * Runs at most ONE case of a running HTTP run, so each call fits in a single
 * serverless invocation. Pacing is enforced here (server side), not only in the browser.
 */
export async function runNextCase(runId: string): Promise<RunStep> {
  if (!(await isOperator())) return { kind: "error", message: "Only operator accounts can run real agent tests." };
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return { kind: "error", message: "Workspace setup is unavailable." };

  const supabase = createClient();
  const { data: runData, error: runError } = await supabase.from("eval_runs").select(evalRunFields).eq("id", runId).eq("project_id", workspace.project.id).maybeSingle();
  if (runError || !runData) return { kind: "error", message: "Run not found." };
  const run = runData as EvalRun;
  if (run.execution_mode !== "http_endpoint" || !run.target_id) return { kind: "error", message: "This is not an HTTP endpoint run." };
  if (run.status !== "running") return { kind: "finished", status: run.status };

  const [{ data: targetData, error: targetError }, { data: doneData, error: doneError }] = await Promise.all([
    supabase.from("targets").select(targetFields).eq("id", run.target_id).maybeSingle(),
    supabase.from("eval_results").select("test_case_id, started_at").eq("eval_run_id", run.id),
  ]);
  if (targetError || !targetData) return { kind: "error", message: "The run's target is unavailable." };
  if (doneError) return { kind: "error", message: "Could not load progress." };
  const target = targetData as Target;
  const done = (doneData ?? []) as Array<{ test_case_id: string; started_at: string | null }>;

  const nextId = nextPendingCase(run.planned_test_case_ids, done.map((row) => row.test_case_id));
  if (!nextId) return finalizeRun(run);

  const lastStarted = done.map((row) => row.started_at).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const waitMs = pacingWaitMs(lastStarted, target.min_delay_ms, Date.now());
  if (waitMs > 0) return { kind: "wait", ms: waitMs };

  const { data: caseData, error: caseError } = await supabase.from("test_cases").select(caseFields).eq("id", nextId).eq("project_id", workspace.project.id).maybeSingle();
  if (caseError || !caseData) return { kind: "error", message: "A planned test case is no longer available." };
  const testCase = caseData as CaseRow;

  const record = await runHttpCase(targetToConfig(target), testCase.input, {
    transport: httpsTransport,
    env: process.env,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: Date.now,
  });

  const scores = record.status === "completed"
    ? scoreEvaluationResult({
      responseOutput: record.output,
      expectedKeywords: testCase.expected_keywords,
      forbiddenKeywords: testCase.forbidden_keywords,
      category: testCase.category,
      priority: testCase.priority,
      latencyMs: record.latencyMs,
      estimatedCost: 0,
    })
    : null;

  const { error: insertError } = await supabase.from("eval_results").insert({
    eval_run_id: run.id,
    test_case_id: testCase.id,
    execution_source: "http_endpoint",
    result_status: record.status,
    target_id: target.id,
    adapter: record.adapter,
    request_url: record.requestUrl,
    request_body: record.requestBody,
    response_status: record.responseStatus,
    response_raw: record.responseRaw,
    response_output: record.output,
    error_code: record.errorCode,
    error_message: record.errorMessage,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    latency_ms: record.latencyMs,
    estimated_cost: 0,
    quality_score: scores?.quality_score ?? 0,
    safety_score: scores?.safety_score ?? 0,
    format_score: scores?.format_score ?? 0,
    latency_score: scores?.latency_score ?? 0,
    cost_score: scores?.cost_score ?? 0,
    total_score: scores?.total_score ?? 0,
    passed: scores?.passed ?? false,
    forbidden_found: scores?.forbidden_found ?? false,
    failure_reason: scores ? scores.failure_reason : `Not run: ${record.errorMessage}`,
  });
  // 23505 = another tab already stored this case; that is fine, move on.
  if (insertError && insertError.code !== "23505") return { kind: "error", message: "The reply was received but could not be saved." };

  revalidatePath(`/evaluations/${run.id}`);
  return { kind: "case", testCaseName: testCase.name, status: record.status, done: done.length + 1, total: run.planned_test_case_ids.length };
}
