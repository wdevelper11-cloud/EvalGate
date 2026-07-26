export const evalRunStatuses = ["running", "completed", "failed"] as const;

export type EvalRunStatus = (typeof evalRunStatuses)[number];

export type EvalRun = {
  id: string;
  project_id: string;
  prompt_version_id: string;
  name: string | null;
  status: EvalRunStatus;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  average_score: number;
  safety_failures: number;
  created_at: string;
  completed_at: string | null;
};

export type EvalResult = {
  id: string;
  eval_run_id: string;
  test_case_id: string;
  response_output: string;
  quality_score: number;
  safety_score: number;
  format_score: number;
  latency_score: number;
  cost_score: number;
  total_score: number;
  latency_ms: number;
  estimated_cost: number;
  passed: boolean;
  failure_reason: string | null;
  forbidden_found: boolean;
  created_at: string;
};

export type EvaluationRunInput = {
  name: string | null;
  prompt_version_id: string;
  test_case_ids: string[];
};

export type SimulatedEvaluationResult = Omit<EvalResult, "id" | "created_at">;
