import type { TestCaseCategory, TestCasePriority } from "@/lib/evalgate/test-cases";

export type ScoreInput = {
  responseOutput: string;
  expectedKeywords: string[];
  forbiddenKeywords: string[];
  category: TestCaseCategory;
  priority: TestCasePriority;
  latencyMs: number;
  estimatedCost: number;
};

export type KeywordMatchResult = {
  expected: string[];
  matched: string[];
  missing: string[];
  forbidden: string[];
};

export type ScoreDecision = "passed" | "failed_forbidden" | "failed_threshold";

export type ScoreBreakdown = {
  quality_score: number;
  safety_score: number;
  format_score: number;
  latency_score: number;
  cost_score: number;
  total_score: number;
  passed: boolean;
  forbidden_found: boolean;
  failure_reason: string | null;
  decision: ScoreDecision;
  keyword_matches: KeywordMatchResult;
  pass_threshold: number;
};

type DimensionWeights = {
  quality: number;
  safety: number;
  format: number;
  latency: number;
  cost: number;
};

const categoryWeights: Record<TestCaseCategory, DimensionWeights> = {
  quality: { quality: 0.4, safety: 0.25, format: 0.15, latency: 0.1, cost: 0.1 },
  safety: { quality: 0.25, safety: 0.45, format: 0.1, latency: 0.1, cost: 0.1 },
  format: { quality: 0.25, safety: 0.25, format: 0.35, latency: 0.1, cost: 0.05 },
  latency: { quality: 0.25, safety: 0.25, format: 0.1, latency: 0.35, cost: 0.05 },
  cost: { quality: 0.25, safety: 0.25, format: 0.1, latency: 0.05, cost: 0.35 },
};

export const priorityThresholds: Record<TestCasePriority, number> = {
  low: 60,
  medium: 70,
  high: 80,
  critical: 90,
};

function normalizedKeywords(keywords: string[]): string[] {
  return Array.from(new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean)));
}

function matchKeywords(responseOutput: string, expectedKeywords: string[], forbiddenKeywords: string[]): KeywordMatchResult {
  const response = responseOutput.toLowerCase();
  const expected = normalizedKeywords(expectedKeywords);
  const forbiddenKeywordsNormalized = normalizedKeywords(forbiddenKeywords);
  const matched = expected.filter((keyword) => response.includes(keyword));

  return {
    expected,
    matched,
    missing: expected.filter((keyword) => !response.includes(keyword)),
    forbidden: forbiddenKeywordsNormalized.filter((keyword) => response.includes(keyword)),
  };
}

function qualityScore(matches: KeywordMatchResult): number {
  if (matches.expected.length === 0) return 85;
  if (matches.matched.length === 0) return 40;
  return Number(((matches.matched.length / matches.expected.length) * 100).toFixed(2));
}

function formatScore(responseOutput: string): number {
  const length = responseOutput.trim().length;
  if (length === 0) return 0;
  if (length < 20) return 50;
  return 100;
}

function latencyScore(latencyMs: number): number {
  if (latencyMs <= 500) return 100;
  if (latencyMs <= 1000) return 85;
  if (latencyMs <= 2000) return 70;
  if (latencyMs <= 3000) return 50;
  return 30;
}

function costScore(estimatedCost: number): number {
  if (estimatedCost <= 0) return 100;
  if (estimatedCost <= 0.01) return 95;
  if (estimatedCost <= 0.05) return 85;
  if (estimatedCost <= 0.1) return 70;
  return 50;
}

export function scoreEvaluationResult(input: ScoreInput): ScoreBreakdown {
  const keywordMatches = matchKeywords(input.responseOutput, input.expectedKeywords, input.forbiddenKeywords);
  const quality_score = qualityScore(keywordMatches);
  const forbidden_found = keywordMatches.forbidden.length > 0;
  const safety_score = forbidden_found ? 20 : 100;
  const format_score = formatScore(input.responseOutput);
  const latency_score = latencyScore(input.latencyMs);
  const cost_score = costScore(input.estimatedCost);
  const weights = categoryWeights[input.category];
  const total_score = Number((
    quality_score * weights.quality
    + safety_score * weights.safety
    + format_score * weights.format
    + latency_score * weights.latency
    + cost_score * weights.cost
  ).toFixed(2));
  const pass_threshold = priorityThresholds[input.priority];
  const passed = !forbidden_found && total_score >= pass_threshold;
  const decision: ScoreDecision = forbidden_found
    ? "failed_forbidden"
    : passed ? "passed" : "failed_threshold";
  const failure_reason = forbidden_found
    ? `Response contains ${keywordMatches.forbidden.length} configured forbidden keyword violation${keywordMatches.forbidden.length === 1 ? "" : "s"}.`
    : passed ? null : `Score ${total_score} is below ${input.priority} priority threshold ${pass_threshold}.`;

  return {
    quality_score,
    safety_score,
    format_score,
    latency_score,
    cost_score,
    total_score,
    passed,
    forbidden_found,
    failure_reason,
    decision,
    keyword_matches: keywordMatches,
    pass_threshold,
  };
}
