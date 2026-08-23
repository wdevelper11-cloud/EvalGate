"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { SimulatedEvaluationResult } from "@/lib/evalgate/evaluations";
import { executeExternalCase, scoreExternalEvidence, type ExternalEvaluation } from "@/lib/evalgate/external-evaluation";
import { HttpEndpointAdapter } from "@/lib/evalgate/http-endpoint-adapter";
import type { PromptVersion } from "@/lib/evalgate/prompt-versions";
import { ProviderAdapterError, type EvaluationEvidence } from "@/lib/evalgate/provider-adapter";
import { generateReleaseDecision } from "@/lib/evalgate/release-decisions";
import { scoreEvaluationResult } from "@/lib/evalgate/scoring";
import type { TestCase } from "@/lib/evalgate/test-cases";
import { mapRecordedEvidence } from "@/lib/evalgate/trace-selection";
import { createClient } from "@/lib/supabase/server";

type PromptSelection = Pick<PromptVersion, "id" | "name" | "version_label" | "prompt_text">;
type TestSelection = Pick<TestCase, "id" | "name" | "input" | "expected_keywords" | "forbidden_keywords" | "category" | "priority" | "status">;
type ExecutionMode = "deterministic" | "http_endpoint" | "recorded_trace";

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(message: string): never {
  redirect(`/evaluations?error=${encodeURIComponent(message)}`);
}

function executionMode(formData: FormData): ExecutionMode {
  const value = formText(formData, "execution_mode") || "deterministic";
  if (value === "deterministic" || value === "http_endpoint" || value === "recorded_trace") return value;
  redirectWithError("Select a valid execution mode.");
}

function safeExternalError(error: unknown): string {
  if (error instanceof ProviderAdapterError) return error.message.slice(0, 180);
  if (error instanceof Error && /^(Row |Trace |Recorded trace)/.test(error.message)) {
    return error.message.replace(/[\r\n]+/g, " ").slice(0, 180);
  }
  return "External evidence could not be evaluated. Check the endpoint contract or recorded-trace format.";
}

function simulateResult(runId: string, prompt: PromptSelection, testCase: TestSelection): ExternalEvaluation {
  const evaluatedText = prompt.prompt_text;
  const latencyMs = 120;
  const estimatedCost = 0;
  const scores = scoreEvaluationResult({
    responseOutput: evaluatedText,
    expectedKeywords: testCase.expected_keywords,
    forbiddenKeywords: testCase.forbidden_keywords,
    category: testCase.category,
    priority: testCase.priority,
    latencyMs,
    estimatedCost,
  });
  const result: SimulatedEvaluationResult = {
    eval_run_id: runId,
    test_case_id: testCase.id,
    response_output: evaluatedText,
    quality_score: scores.quality_score,
    safety_score: scores.safety_score,
    format_score: scores.format_score,
    latency_score: scores.latency_score,
    cost_score: scores.cost_score,
    total_score: scores.total_score,
    latency_ms: latencyMs,
    estimated_cost: estimatedCost,
    passed: scores.passed,
    failure_reason: scores.failure_reason,
    forbidden_found: scores.forbidden_found,
  };
  return {
    result,
    keywordMatches: scores.keyword_matches,
    evidence: {
      output: evaluatedText,
      latencyMs,
      estimatedCostUsd: estimatedCost,
      provider: "deterministic",
    },
  };
}

function configuredHttpAdapter(): HttpEndpointAdapter {
  const name = process.env.EVALGATE_PROVIDER_NAME?.trim() || "buyer-endpoint";
  const endpointUrl = process.env.EVALGATE_PROVIDER_URL?.trim() || "";
  if (!endpointUrl) {
    throw new ProviderAdapterError("invalid_configuration", "The server-side endpoint URL is not configured.", false);
  }
  const timeoutText = process.env.EVALGATE_PROVIDER_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutText ? Number(timeoutText) : 15_000;
  return new HttpEndpointAdapter({
    name,
    endpointUrl,
    authorizationHeader: process.env.EVALGATE_PROVIDER_AUTHORIZATION,
    timeoutMs,
  });
}

function persistedResult(
  item: ExternalEvaluation,
  mode: ExecutionMode,
  prompt: PromptSelection,
  testCase: TestSelection,
) {
  const evidence: EvaluationEvidence = item.evidence;
  return {
    ...item.result,
    execution_source: mode,
    provider_name: evidence.provider,
    provider_request_id: evidence.requestId ?? null,
    input_payload: { prompt: prompt.prompt_text, input: testCase.input },
    trace_payload: evidence.trace ?? null,
    input_tokens: evidence.inputTokens ?? null,
    output_tokens: evidence.outputTokens ?? null,
  };
}

export async function runEvaluation(formData: FormData) {
  const mode = executionMode(formData);
  const promptVersionId = formText(formData, "prompt_version_id");
  const testCaseIds = Array.from(new Set(formData.getAll("test_case_ids").filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  )));

  if (!promptVersionId) redirectWithError("Select a prompt version.");
  if (testCaseIds.length === 0) redirectWithError("Select at least one active test case.");

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("Workspace setup is unavailable. Please try again.");
  const supabase = createClient();
  const [{ data: promptData, error: promptError }, { data: testData, error: testError }] = await Promise.all([
    supabase.from("prompt_versions").select("id, name, version_label, prompt_text").eq("id", promptVersionId).eq("project_id", workspace.project.id).maybeSingle(),
    supabase.from("test_cases").select("id, name, input, expected_keywords, forbidden_keywords, category, priority, status").eq("project_id", workspace.project.id).eq("status", "active").in("id", testCaseIds),
  ]);

  const prompt = promptData as PromptSelection | null;
  const testCases = (testData ?? []) as TestSelection[];
  if (promptError || !prompt) redirectWithError("The selected prompt version is unavailable.");
  if (testError || testCases.length !== testCaseIds.length) redirectWithError("One or more selected test cases are unavailable or inactive.");

  const runName = formText(formData, "name") || null;
  const { data: runData, error: runError } = await supabase
    .from("eval_runs")
    .insert({
      project_id: workspace.project.id,
      prompt_version_id: prompt.id,
      name: runName,
      status: "running",
      total_tests: testCases.length,
      execution_mode: mode,
    })
    .select("id")
    .single();

  if (runError || !runData) redirectWithError("Could not start the evaluation run. Confirm the external-evidence schema patch is applied.");
  const run = runData as { id: string };
  let evaluatedCases: ExternalEvaluation[];
  try {
    if (mode === "deterministic") {
      evaluatedCases = testCases.map((testCase) => simulateResult(run.id, prompt, testCase));
    } else if (mode === "http_endpoint") {
      const provider = configuredHttpAdapter();
      evaluatedCases = [];
      for (const testCase of testCases) {
        evaluatedCases.push(await executeExternalCase(provider, run.id, prompt.prompt_text, testCase));
      }
    } else {
      const evidenceByCase = mapRecordedEvidence(formText(formData, "trace_payload"), formText(formData, "trace_format"), testCases);
      evaluatedCases = testCases.map((testCase) => scoreExternalEvidence(run.id, testCase, evidenceByCase.get(testCase.id)!));
    }
  } catch (error) {
    await supabase.from("eval_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id).eq("project_id", workspace.project.id);
    redirectWithError(safeExternalError(error));
  }

  const results = evaluatedCases.map((item, index) => persistedResult(item, mode, prompt, testCases[index]));
  const { error: resultsError } = await supabase.from("eval_results").insert(results);
  if (resultsError) {
    await supabase.from("eval_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id).eq("project_id", workspace.project.id);
    redirectWithError("Could not save all evaluation results. The run was marked as failed.");
  }

  const passedTests = results.filter((result) => result.passed).length;
  const safetyFailures = results.filter((result) => result.forbidden_found).length;
  const averageScore = Number((results.reduce((sum, result) => sum + result.total_score, 0) / results.length).toFixed(2));
  const expectedKeywordCount = evaluatedCases.reduce((sum, item) => sum + item.keywordMatches.expected.length, 0);
  const expectedKeywordMatches = evaluatedCases.reduce((sum, item) => sum + item.keywordMatches.matched.length, 0);
  const expectedKeywordCoverage = expectedKeywordCount === 0 ? 100 : (expectedKeywordMatches / expectedKeywordCount) * 100;
  const { error: completionError } = await supabase
    .from("eval_runs")
    .update({
      status: "completed",
      total_tests: results.length,
      passed_tests: passedTests,
      failed_tests: results.length - passedTests,
      average_score: averageScore,
      safety_failures: safetyFailures,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("project_id", workspace.project.id);

  if (completionError) {
    await supabase.from("eval_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", run.id).eq("project_id", workspace.project.id);
    redirectWithError("Results were saved, but the evaluation run could not be completed.");
  }

  const releaseDecision = generateReleaseDecision({
    averageScore,
    totalTests: results.length,
    passedTests,
    failedTests: results.length - passedTests,
    safetyFailures,
    expectedKeywordCoverage,
  });
  const { error: decisionError } = await supabase.from("release_decisions").insert({
    project_id: workspace.project.id,
    eval_run_id: run.id,
    decision: releaseDecision.decision,
    total_score: releaseDecision.total_score,
    reason: releaseDecision.reason,
  });

  if (decisionError) {
    revalidatePath("/evaluations");
    redirectWithError("The evaluation completed, but its release decision could not be saved.");
  }

  revalidatePath("/evaluations");
  revalidatePath("/results");
  revalidatePath("/reports");
  redirect("/evaluations");
}
