export const testCaseCategories = ["quality", "safety", "format", "latency", "cost"] as const;
export const testCasePriorities = ["low", "medium", "high", "critical"] as const;
export const testCaseStatuses = ["active", "archived"] as const;

export type TestCaseCategory = (typeof testCaseCategories)[number];
export type TestCasePriority = (typeof testCasePriorities)[number];
export type TestCaseStatus = (typeof testCaseStatuses)[number];

export type TestCase = {
  id: string;
  project_id: string;
  name: string;
  input: string;
  expected_keywords: string[];
  forbidden_keywords: string[];
  category: TestCaseCategory;
  priority: TestCasePriority;
  status: TestCaseStatus;
  created_at: string;
  updated_at: string;
};

export type CreateTestCaseInput = Pick<
  TestCase,
  "name" | "input" | "expected_keywords" | "forbidden_keywords" | "category" | "priority" | "status"
>;

export function isTestCaseCategory(value: string): value is TestCaseCategory {
  return testCaseCategories.some((category) => category === value);
}

export function isTestCasePriority(value: string): value is TestCasePriority {
  return testCasePriorities.some((priority) => priority === value);
}

export function isTestCaseStatus(value: string): value is TestCaseStatus {
  return testCaseStatuses.some((status) => status === value);
}

export function parseKeywordList(value: string): string[] {
  const keywords = value.split(",").map((keyword) => keyword.trim()).filter(Boolean);
  return Array.from(new Set(keywords));
}
