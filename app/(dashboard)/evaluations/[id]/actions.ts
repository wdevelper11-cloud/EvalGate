"use server";

import { revalidatePath } from "next/cache";
import { runHttpCase } from "@/lib/evalgate/adapters/http-endpoint";
import { httpsTransport } from "@/lib/evalgate/adapters/transport";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { evalRunFields, type EvalRun } from "@/lib/evalgate/evaluations";
import { isOperator } from "@/lib/evalgate/operator";
import { isStalePending, MAX_CASES_PER_RUN, nextPendingCase, summarizeRun, type StoredCaseResult } from "@/lib/evalgate/run-plan";
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
type ResultRow = { id: string; test_case_id: string; result_status: "pending" | "completed" | "error"; started_at: string | null };
const caseFields = "id, name, input, expected_keywords, forbidden_keywords, category, priority";
/** How long to tell the browser to wait while another call has a question in flight. */
const IN_FLIGHT_RETRY_MS = 2000;

/**
 * Closes a running run (once) and makes sure it has its decision. Safe to call
 * again on a completed run: a decision that failed to save is written then.
 */
async function finalizeRun(run: EvalRun): Promise<RunStep> {
  const supabase = createClient();
  const [{ data: rows, error: rowsError }, { data: caseData, error: caseError }] = await Promise.all([
    supabase.from("eval_results").select("test_case_id, result_status, passed, total_score, forbidden_found, response_output").eq("eval_run_id", run.id),
    supabase.from("test_cases").select(caseFields).eq("project_id", run.project_id).in("id", run.planned_test_case_ids),
  ]);
  if (rowsError || caseError) return { kind: "error", message: "Could not load results to finish the run." };

  const typedRows = (rows ?? []) as Array<{ test_case_id: string; result_status: StoredCaseResult["result_status"]; passed: boolean; total_score: number; forbidden_found: boolean; response_output: string }>;
  if (run.status === "running" && typedRows.some((row) => row.result_status === "pending")) return { kind: "wait", ms: IN_FLIGHT_RETRY_MS };

  const cases = new Map(((caseData ?? []) as CaseRow[]).map((testCase) => [testCase.id, testCase]));
  const stored: StoredCaseResult[] = typedRows.map((row) => {
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
  if (run.status === "running") {
    const { error: updateError } = await supabase
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
      .eq("status", "running");
    if (updateError) return { kind: "error", message: "Could not save the run summary." };
  }

  if (summary.status === "completed" && summary.decision) {
    const { error: decisionError } = await supabase.from("release_decisions").insert({
      project_id: run.project_id,
      eval_run_id: run.id,
      decision: summary.decision.decision,
      total_score: summary.decision.total_score,
      reason: summary.decision.reason,
    });
    // 23505: the decision already exists (another call wrote it first).
    if (decisionError && decisionError.code !== "23505") {
      return { kind: "error", message: "The run finished but its decision could not be saved. Press Resume to retry." };
    }
  }

  revalidatePath("/evaluations");
  revalidatePath(`/evaluations/${run.id}`);
  revalidatePath("/results");
  revalidatePath("/reports");
  return { kind: "finished", status: summary.status };
}

/**
 * Sends at most ONE question of a running HTTP run, so each call fits in a
 * single serverless invocation. Pacing and "one question in flight" are
 * enforced in the database, so parallel or tampered calls cannot break them:
 *  1. claim_target_send_slot() atomically takes the target's next send slot
 *     (min_delay_ms apart, per target, across all runs and test connections);
 *  2. a 'pending' result row claims the case (unique per run + case), so the
 *     same question is never sent twice;
 *  3. the row is finalised exactly once (write-once trigger).
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
  if (run.planned_test_case_ids.length > MAX_CASES_PER_RUN) {
    return { kind: "error", message: `This run plans ${run.planned_test_case_ids.length} cases; the limit is ${MAX_CASES_PER_RUN}. Nothing was sent.` };
  }
  if (run.status !== "running") {
    // Repair path: make sure a finished run has its decision.
    return run.status === "completed" ? finalizeRun(run) : { kind: "finished", status: run.status };
  }

  const [{ data: targetData, error: targetError }, { data: resultData, error: resultError }, { data: existingCases, error: existingError }] = await Promise.all([
    supabase.from("targets").select(targetFields).eq("id", run.target_id).maybeSingle(),
    supabase.from("eval_results").select("id, test_case_id, result_status, started_at").eq("eval_run_id", run.id),
    supabase.from("test_cases").select("id").eq("project_id", workspace.project.id).in("id", run.planned_test_case_ids),
  ]);
  if (targetError || !targetData) return { kind: "error", message: "The run's target is unavailable." };
  if (resultError || existingError) return { kind: "error", message: "Could not load progress." };
  const target = targetData as Target;
  const results = (resultData ?? []) as ResultRow[];

  // A question left in flight by a call that died is recorded as an error, never re-sent.
  const now = Date.now();
  for (const row of results.filter((result) => result.result_status === "pending" && isStalePending(result.started_at, now))) {
    await supabase.from("eval_results").update({
      result_status: "error",
      error_code: "interrupted",
      error_message: "The server call ended before a reply was saved. The question may have reached the endpoint; it is not re-sent.",
      completed_at: new Date().toISOString(),
      failure_reason: "Not run: interrupted",
    }).eq("id", row.id).eq("result_status", "pending");
  }
  if (results.some((result) => result.result_status === "pending" && !isStalePending(result.started_at, now))) {
    return { kind: "wait", ms: IN_FLIGHT_RETRY_MS };
  }

  // Planned cases whose test case no longer exists are skipped (counted as errored at the end).
  const existing = new Set(((existingCases ?? []) as Array<{ id: string }>).map((row) => row.id));
  const nextId = nextPendingCase(run.planned_test_case_ids.filter((id) => existing.has(id)), results.map((row) => row.test_case_id));
  if (!nextId) return finalizeRun(run);

  const { data: waitData, error: claimError } = await supabase.rpc("claim_target_send_slot", { p_target_id: target.id });
  if (claimError || typeof waitData !== "number" || waitData < 0) return { kind: "error", message: "Could not reserve a send slot for this target." };
  if (waitData > 0) return { kind: "wait", ms: waitData };

  const { data: caseData, error: caseError } = await supabase.from("test_cases").select(caseFields).eq("id", nextId).eq("project_id", workspace.project.id).maybeSingle();
  if (caseError || !caseData) return { kind: "wait", ms: IN_FLIGHT_RETRY_MS };
  const testCase = caseData as CaseRow;

  const startedAt = new Date().toISOString();
  const { data: pendingData, error: pendingError } = await supabase.from("eval_results").insert({
    eval_run_id: run.id,
    test_case_id: testCase.id,
    execution_source: "http_endpoint",
    result_status: "pending",
    target_id: target.id,
    adapter: "http_endpoint",
    request_url: target.endpoint_url,
    response_output: "",
    started_at: startedAt,
  }).select("id").single();
  // 23505: another call already claimed this case.
  if (pendingError?.code === "23505") return { kind: "wait", ms: IN_FLIGHT_RETRY_MS };
  if (pendingError || !pendingData) return { kind: "error", message: "Could not record the question before sending it. Nothing was sent." };
  const pendingId = (pendingData as { id: string }).id;

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

  const { error: finalError } = await supabase.from("eval_results").update({
    result_status: record.status,
    adapter: record.adapter,
    request_url: record.requestUrl,
    request_body: record.requestBody,
    response_status: record.responseStatus,
    response_raw: record.responseRaw,
    response_output: record.output,
    error_code: record.errorCode,
    error_message: record.errorMessage,
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
  }).eq("id", pendingId).eq("result_status", "pending");
  if (finalError) return { kind: "error", message: "The reply was received but could not be saved; the case will be marked interrupted." };

  revalidatePath(`/evaluations/${run.id}`);
  const done = results.filter((row) => row.test_case_id !== testCase.id).length + 1;
  return { kind: "case", testCaseName: testCase.name, status: record.status, done, total: run.planned_test_case_ids.length };
}
