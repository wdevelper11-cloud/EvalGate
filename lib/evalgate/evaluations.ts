export const evalRunStatuses = ["running", "completed", "failed"] as const;

export type EvalRunStatus = (typeof evalRunStatuses)[number];

export const executionModes = ["simulated", "http_endpoint"] as const;
export type ExecutionMode = (typeof executionModes)[number];

export const executionModeLabels: Record<ExecutionMode, string> = {
  simulated: "Simulated (dev fixture, not a real agent)",
  http_endpoint: "HTTP endpoint",
};

export type EvalRun = {
  id: string;
  project_id: string;
  prompt_version_id: string | null;
  execution_mode: ExecutionMode;
  target_id: string | null;
  planned_test_case_ids: string[];
  errored_tests: number;
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
  execution_source: ExecutionMode;
  result_status: "completed" | "error";
  target_id: string | null;
  adapter: string | null;
  request_url: string | null;
  request_body: unknown | null;
  response_status: number | null;
  response_raw: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
};

export const evalRunFields =
  "id, project_id, prompt_version_id, execution_mode, target_id, planned_test_case_ids, errored_tests, name, status, total_tests, passed_tests, failed_tests, average_score, safety_failures, created_at, completed_at";

export type EvaluationRunInput = {
  name: string | null;
  prompt_version_id: string;
  test_case_ids: string[];
};

/** Row shape inserted for a simulated (dev fixture) result; evidence columns use their defaults. */
export type SimulatedEvaluationResult = Pick<EvalResult,
  "eval_run_id" | "test_case_id" | "response_output" | "quality_score" | "safety_score" | "format_score"
  | "latency_score" | "cost_score" | "total_score" | "latency_ms" | "estimated_cost" | "passed"
  | "failure_reason" | "forbidden_found"> & { execution_source: "simulated" };
