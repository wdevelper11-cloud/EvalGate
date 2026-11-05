import { generateReleaseDecision, type ReleaseDecisionResult } from "./release-decisions.ts";

export const MAX_CASES_PER_RUN = 50;

/** First planned case that has no stored result yet, in plan order. */
export function nextPendingCase(plannedIds: string[], doneIds: Iterable<string>): string | null {
  const done = new Set(doneIds);
  return plannedIds.find((id) => !done.has(id)) ?? null;
}

/**
 * How long to wait before the next question may be sent, so we behave like one
 * person typing: at least minDelayMs between the starts of consecutive questions.
 */
export function pacingWaitMs(lastStartedAt: string | null, minDelayMs: number, nowMs: number): number {
  if (!lastStartedAt) return 0;
  const last = Date.parse(lastStartedAt);
  if (Number.isNaN(last)) return minDelayMs;
  return Math.max(0, last + minDelayMs - nowMs);
}

export type StoredCaseResult = {
  result_status: "completed" | "error";
  passed: boolean;
  total_score: number;
  forbidden_found: boolean;
  /** Keyword coverage counts, only meaningful for completed rows. */
  expected_count: number;
  matched_count: number;
};

export type RunSummary = {
  status: "completed" | "failed";
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  errored_tests: number;
  average_score: number;
  safety_failures: number;
  decision: ReleaseDecisionResult | null;
};

/**
 * Summarises a finished run. Adapter errors are NOT agent failures: they are
 * counted separately, excluded from pass/fail and the average, and force at
 * least "needs_review" because the run is incomplete.
 */
export function summarizeRun(results: StoredCaseResult[], plannedCount: number): RunSummary {
  const completed = results.filter((result) => result.result_status === "completed");
  const errored = results.length - completed.length;
  const passed = completed.filter((result) => result.passed).length;
  const failed = completed.length - passed;
  const safety = completed.filter((result) => result.forbidden_found).length;
  const average = completed.length === 0
    ? 0
    : Number((completed.reduce((sum, result) => sum + Number(result.total_score), 0) / completed.length).toFixed(2));

  if (completed.length === 0) {
    return { status: "failed", total_tests: plannedCount, passed_tests: 0, failed_tests: 0, errored_tests: errored, average_score: 0, safety_failures: 0, decision: null };
  }

  const expected = completed.reduce((sum, result) => sum + result.expected_count, 0);
  const matched = completed.reduce((sum, result) => sum + result.matched_count, 0);
  let decision = generateReleaseDecision({
    averageScore: average,
    totalTests: completed.length,
    passedTests: passed,
    failedTests: failed,
    safetyFailures: safety,
    expectedKeywordCoverage: expected === 0 ? 100 : (matched / expected) * 100,
  });
  if (errored > 0 && decision.decision === "ship") {
    decision = {
      decision: "needs_review",
      total_score: decision.total_score,
      reason: `${errored} of ${plannedCount} cases could not be run (adapter errors), so the result is incomplete. ${completed.length} completed cases all passed.`,
    };
  } else if (errored > 0) {
    decision = { ...decision, reason: `${decision.reason} ${errored} of ${plannedCount} cases could not be run (adapter errors).` };
  }

  return {
    status: "completed",
    total_tests: plannedCount,
    passed_tests: passed,
    failed_tests: failed,
    errored_tests: errored,
    average_score: average,
    safety_failures: safety,
    decision,
  };
}
