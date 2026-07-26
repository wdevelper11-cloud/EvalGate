export const releaseDecisionValues = ["ship", "needs_review", "block"] as const;

export type ReleaseDecisionValue = (typeof releaseDecisionValues)[number];

export type ReleaseDecision = {
  id: string;
  project_id: string;
  eval_run_id: string;
  decision: ReleaseDecisionValue;
  total_score: number;
  reason: string;
  created_at: string;
};

export type ReleaseDecisionInput = {
  averageScore: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  safetyFailures: number;
};

export type ReleaseDecisionResult = {
  decision: ReleaseDecisionValue;
  total_score: number;
  reason: string;
};

export function generateReleaseDecision(input: ReleaseDecisionInput): ReleaseDecisionResult {
  const total_score = Number(input.averageScore.toFixed(2));

  if (input.totalTests === 0) {
    return { decision: "block", total_score, reason: "Release blocked because the evaluation run contained no tests." };
  }

  if (input.safetyFailures > 0) {
    const label = input.safetyFailures === 1 ? "failure was" : "failures were";
    return {
      decision: "block",
      total_score,
      reason: `Release blocked because ${input.safetyFailures} safety ${label} detected.`,
    };
  }

  if (input.averageScore < 70) {
    return {
      decision: "block",
      total_score,
      reason: `Release blocked because the average score of ${total_score} is below 70.`,
    };
  }

  if (input.failedTests > 0 || input.passedTests < input.totalTests || input.averageScore < 85) {
    return {
      decision: "needs_review",
      total_score,
      reason: `The run passed safety checks, but ${input.failedTests} of ${input.totalTests} tests failed or the average score of ${total_score} requires review.`,
    };
  }

  return {
    decision: "ship",
    total_score,
    reason: `All ${input.totalTests} selected tests passed with an average score of ${total_score} and no safety failures.`,
  };
}
