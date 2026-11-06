import { generateReleaseDecision, type ReleaseDecisionResult } from "./release-decisions.ts";

export const MAX_CASES_PER_RUN = 50;

/** First planned case that has no stored result yet, in plan order. */
export function nextPendingCase(plannedIds: string[], doneIds: Iterable<string>): string | null {
  const done = new Set(doneIds);
  return plannedIds.find((id) => !done.has(id)) ?? null;
}

export type StoredCaseResult = {
  result_status: "pending" | "completed" | "error";
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
 * least "needs_review" because the run is incomplete. Every planned case that
 * did not complete (adapter error, or its test case no longer exists) counts
 * as errored.
 */
export function summarizeRun(results: StoredCaseResult[], plannedCount: number): RunSummary {
  const completed = results.filter((result) => result.result_status === "completed");
  const errored = Math.max(0, plannedCount - completed.length);
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

/** A pending (in-flight) result older than this is treated as interrupted. */
export const STALE_PENDING_MS = 90_000;

export function isStalePending(startedAt: string | null, nowMs: number): boolean {
  if (!startedAt) return true;
  const started = Date.parse(startedAt);
  return Number.isNaN(started) || nowMs - started > STALE_PENDING_MS;
}
