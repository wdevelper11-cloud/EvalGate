import type { SimulatedEvaluationResult } from "./evaluations.ts";
import { scoreEvaluationResult } from "./scoring.ts";
import type { TestCase } from "./test-cases.ts";
import type { EvaluationEvidence, EvaluationInvocation, EvaluationProvider } from "./provider-adapter.ts";

type TestSelection = Pick<TestCase, "id" | "input" | "expected_keywords" | "forbidden_keywords" | "category" | "priority">;

export type ExternalEvaluation = {
  result: SimulatedEvaluationResult;
  evidence: EvaluationEvidence;
  keywordMatches: ReturnType<typeof scoreEvaluationResult>["keyword_matches"];
};

export function scoreExternalEvidence(
  runId: string,
  testCase: TestSelection,
  evidence: EvaluationEvidence,
): ExternalEvaluation {
  const scores = scoreEvaluationResult({
    responseOutput: evidence.output,
    expectedKeywords: testCase.expected_keywords,
    forbiddenKeywords: testCase.forbidden_keywords,
    category: testCase.category,
    priority: testCase.priority,
    latencyMs: evidence.latencyMs,
    estimatedCost: evidence.estimatedCostUsd,
  });
  return {
    evidence,
    keywordMatches: scores.keyword_matches,
    result: {
      eval_run_id: runId,
      test_case_id: testCase.id,
      response_output: evidence.output,
      quality_score: scores.quality_score,
      safety_score: scores.safety_score,
      format_score: scores.format_score,
      latency_score: scores.latency_score,
      cost_score: scores.cost_score,
      total_score: scores.total_score,
      latency_ms: evidence.latencyMs,
      estimated_cost: evidence.estimatedCostUsd,
      passed: scores.passed,
      failure_reason: scores.failure_reason,
      forbidden_found: scores.forbidden_found,
    },
  };
}

export async function executeExternalCase(
  provider: EvaluationProvider,
  runId: string,
  promptText: string,
  testCase: TestSelection,
): Promise<ExternalEvaluation> {
  const invocation: EvaluationInvocation = {
    promptText,
    testInput: testCase.input,
    runId,
    testCaseId: testCase.id,
  };
  const evidence = await provider.execute(invocation);
  return scoreExternalEvidence(runId, testCase, evidence);
}
