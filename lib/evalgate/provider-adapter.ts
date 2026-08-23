export type ExecutionMetadata = Record<string, string | number | boolean | null>;

export type EvaluationInvocation = {
  promptText: string;
  testInput: string;
  runId?: string;
  testCaseId?: string;
  metadata?: ExecutionMetadata;
};

export type TraceEvent = {
  type: string;
  name?: string;
  startedAt?: string;
  completedAt?: string;
  status?: "ok" | "error" | "unknown";
  attributes?: Record<string, unknown>;
};

export type EvaluationEvidence = {
  output: string;
  latencyMs: number;
  estimatedCostUsd: number;
  provider: string;
  requestId?: string;
  inputTokens?: number;
  outputTokens?: number;
  trace?: TraceEvent[];
  raw?: Record<string, unknown>;
};

export interface EvaluationProvider {
  readonly name: string;
  execute(invocation: EvaluationInvocation): Promise<EvaluationEvidence>;
}

export type ProviderErrorCode =
  | "invalid_configuration"
  | "timeout"
  | "network_error"
  | "http_error"
  | "invalid_response";

export class ProviderAdapterError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(
    code: ProviderErrorCode,
    message: string,
    retryable: boolean,
    status?: number,
  ) {
    super(message);
    this.name = "ProviderAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

export function nonNegativeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}
