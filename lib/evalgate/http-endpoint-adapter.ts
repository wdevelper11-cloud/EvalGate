import {
  ProviderAdapterError,
  nonNegativeNumber,
  type EvaluationEvidence,
  type EvaluationInvocation,
  type EvaluationProvider,
  type TraceEvent,
} from "./provider-adapter.ts";

export type HttpEndpointAdapterConfig = {
  name: string;
  endpointUrl: string;
  authorizationHeader?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

type EndpointResponse = {
  output?: unknown;
  request_id?: unknown;
  latency_ms?: unknown;
  estimated_cost_usd?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  trace?: unknown;
  [key: string]: unknown;
};

function validateEndpointUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderAdapterError("invalid_configuration", "Endpoint URL is invalid.", false);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new ProviderAdapterError(
      "invalid_configuration",
      "Endpoint must use HTTPS; HTTP is allowed only for localhost development.",
      false,
    );
  }
  return url;
}

function parseTrace(value: unknown): TraceEvent[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ProviderAdapterError("invalid_response", "Endpoint trace must be an array when supplied.", false);
  }
  return value.map((event, index) => {
    if (!event || typeof event !== "object" || typeof (event as { type?: unknown }).type !== "string") {
      throw new ProviderAdapterError("invalid_response", `Trace event ${index + 1} requires a string type.`, false);
    }
    return event as TraceEvent;
  });
}

export class HttpEndpointAdapter implements EvaluationProvider {
  readonly name: string;
  private readonly url: URL;
  private readonly authorizationHeader?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: HttpEndpointAdapterConfig) {
    if (!config.name.trim()) {
      throw new ProviderAdapterError("invalid_configuration", "Adapter name is required.", false);
    }
    this.name = config.name.trim();
    this.url = validateEndpointUrl(config.endpointUrl);
    this.authorizationHeader = config.authorizationHeader?.trim() || undefined;
    this.timeoutMs = config.timeoutMs ?? 15_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 120_000) {
      throw new ProviderAdapterError("invalid_configuration", "Timeout must be an integer from 500 to 120000 ms.", false);
    }
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async execute(invocation: EvaluationInvocation): Promise<EvaluationEvidence> {
    if (!invocation.promptText.trim() || !invocation.testInput.trim()) {
      throw new ProviderAdapterError("invalid_configuration", "Prompt text and test input are required.", false);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.authorizationHeader ? { authorization: this.authorizationHeader } : {}),
          ...(invocation.runId ? { "idempotency-key": `${invocation.runId}:${invocation.testCaseId ?? "case"}` } : {}),
        },
        body: JSON.stringify({
          prompt: invocation.promptText,
          input: invocation.testInput,
          metadata: invocation.metadata ?? {},
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ProviderAdapterError("timeout", `Endpoint exceeded ${this.timeoutMs} ms.`, true);
      }
      throw new ProviderAdapterError("network_error", "Endpoint request failed before a response was received.", true);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new ProviderAdapterError(
        "http_error",
        `Endpoint returned HTTP ${response.status}.`,
        response.status === 408 || response.status === 429 || response.status >= 500,
        response.status,
      );
    }

    let payload: EndpointResponse;
    try {
      payload = await response.json() as EndpointResponse;
    } catch {
      throw new ProviderAdapterError("invalid_response", "Endpoint response was not valid JSON.", false);
    }
    if (typeof payload.output !== "string" || !payload.output.trim()) {
      throw new ProviderAdapterError("invalid_response", "Endpoint response requires a non-empty output string.", false);
    }

    return {
      output: payload.output,
      latencyMs: nonNegativeNumber(payload.latency_ms, Date.now() - started),
      estimatedCostUsd: nonNegativeNumber(payload.estimated_cost_usd),
      provider: this.name,
      requestId: typeof payload.request_id === "string" ? payload.request_id : undefined,
      inputTokens: typeof payload.input_tokens === "number" ? nonNegativeNumber(payload.input_tokens) : undefined,
      outputTokens: typeof payload.output_tokens === "number" ? nonNegativeNumber(payload.output_tokens) : undefined,
      trace: parseTrace(payload.trace),
      raw: payload,
    };
  }
}

