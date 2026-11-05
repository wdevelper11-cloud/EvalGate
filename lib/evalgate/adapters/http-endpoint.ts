import { AdapterError, type AdapterErrorCode } from "./errors.ts";
import { validateTargetUrl } from "./network-guard.ts";
import type { Transport } from "./transport.ts";

export type RequestFormat = "openai_chat" | "custom_json";

export type HttpTargetConfig = {
  endpointUrl: string;
  requestFormat: RequestFormat;
  model?: string | null;
  /** custom_json only: any JSON value; every "{{input}}" inside a string is replaced with the question. */
  requestTemplate?: unknown;
  /** Dot path to the reply text, e.g. "choices.0.message.content". */
  responsePath?: string | null;
  authHeaderName: string;
  authScheme?: string | null;
  /** Name of the server env var holding the key. The key itself is never stored. */
  keyEnvVar?: string | null;
  timeoutMs: number;
};

/** The evidence record for one question sent to one target. */
export type EvidenceRecord = {
  adapter: "http_endpoint";
  status: "completed" | "error";
  requestUrl: string;
  /** Exact JSON body sent. Contains no secrets (the key only ever travels in a header). */
  requestBody: unknown | null;
  responseStatus: number | null;
  /** Raw response text, capped at RAW_RESPONSE_CAP_BYTES, with the key redacted. */
  responseRaw: string | null;
  /** The extracted reply text; "" when status is "error". */
  output: string;
  errorCode: AdapterErrorCode | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
  attempts: number;
};

export type AdapterDeps = {
  transport: Transport;
  env: Record<string, string | undefined>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export const INPUT_PLACEHOLDER = "{{input}}";
export const DEFAULT_OPENAI_RESPONSE_PATH = "choices.0.message.content";
export const RAW_RESPONSE_CAP_BYTES = 64_000;
export const MAX_RETRY_AFTER_MS = 20_000;
export const DEFAULT_RETRY_AFTER_MS = 10_000;
export const USER_AGENT = "PreshockAI-Tester/1.0";

const forbiddenHeaderNames = new Set([
  "host", "content-length", "content-type", "accept", "connection", "transfer-encoding",
  "user-agent", "cookie", "te", "upgrade", "expect", "keep-alive", "proxy-authorization",
]);

export function isAllowedAuthHeaderName(name: string): boolean {
  return /^[A-Za-z0-9-]{1,64}$/.test(name) && !forbiddenHeaderNames.has(name.toLowerCase());
}

export function templateHasPlaceholder(template: unknown): boolean {
  if (typeof template === "string") return template.includes(INPUT_PLACEHOLDER);
  if (Array.isArray(template)) return template.some(templateHasPlaceholder);
  if (template && typeof template === "object") return Object.values(template).some(templateHasPlaceholder);
  return false;
}

/** Substitutes the question into parsed JSON, so quotes and newlines are escaped by JSON.stringify. */
export function substituteInput(template: unknown, input: string): unknown {
  if (typeof template === "string") return template.split(INPUT_PLACEHOLDER).join(input);
  if (Array.isArray(template)) return template.map((item) => substituteInput(item, input));
  if (template && typeof template === "object") {
    return Object.fromEntries(Object.entries(template).map(([key, value]) => [key, substituteInput(value, input)]));
  }
  return template;
}

export function buildRequestBody(config: HttpTargetConfig, input: string): unknown {
  if (config.requestFormat === "openai_chat") {
    return {
      ...(config.model ? { model: config.model } : {}),
      messages: [{ role: "user", content: input }],
    };
  }
  if (!templateHasPlaceholder(config.requestTemplate)) {
    throw new AdapterError("invalid_configuration", `Request template must contain ${INPUT_PLACEHOLDER}.`);
  }
  return substituteInput(config.requestTemplate, input);
}

export function isValidResponsePath(path: string): boolean {
  return /^[A-Za-z0-9_$-]+(\.[A-Za-z0-9_$-]+)*$/.test(path);
}

/** Reads a dot path such as "choices.0.message.content". Returns undefined when absent. */
export function readPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) current = current[Number(segment)];
    else if (current && typeof current === "object" && !Array.isArray(current)) {
      current = Object.prototype.hasOwnProperty.call(current, segment)
        ? (current as Record<string, unknown>)[segment]
        : undefined;
    } else return undefined;
    if (current === undefined) return undefined;
  }
  return current;
}

export function responsePathFor(config: HttpTargetConfig): string {
  const path = config.responsePath?.trim();
  if (path) return path;
  if (config.requestFormat === "openai_chat") return DEFAULT_OPENAI_RESPONSE_PATH;
  throw new AdapterError("invalid_configuration", "A response path is required for custom JSON targets.");
}

export function capText(text: string, maxBytes = RAW_RESPONSE_CAP_BYTES): string {
  const buffer = Buffer.from(text, "utf8");
  if (buffer.length <= maxBytes) return text;
  return `${buffer.subarray(0, maxBytes).toString("utf8")}\n…[truncated: ${buffer.length} bytes total]`;
}

function redact(text: string, secret: string | undefined): string {
  if (!secret || secret.length < 4) return text;
  return text.split(secret).join("[REDACTED]");
}

/** Parses Retry-After (seconds or HTTP date) into ms; falls back to DEFAULT_RETRY_AFTER_MS. */
export function parseRetryAfter(value: string | undefined, nowMs: number): number {
  if (!value) return DEFAULT_RETRY_AFTER_MS;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) return Math.max(0, date - nowMs);
  return DEFAULT_RETRY_AFTER_MS;
}

/**
 * Sends one question to one HTTP target and returns its evidence record.
 * Never throws: every failure is recorded as status "error" with a code.
 * Retries exactly once, and only after HTTP 429 with an acceptable Retry-After.
 */
export async function runHttpCase(config: HttpTargetConfig, input: string, deps: AdapterDeps): Promise<EvidenceRecord> {
  const startedMs = deps.now();
  const startedAt = new Date(startedMs).toISOString();
  let requestBody: unknown | null = null;
  let responseStatus: number | null = null;
  let responseRaw: string | null = null;
  let attempts = 0;
  let attemptStartedMs = startedMs;
  // Only TARGET_KEY_* variables may ever be read, so no other server secret can leak to a target.
  const keyNameAllowed = !config.keyEnvVar || /^TARGET_KEY_[A-Z0-9_]{1,64}$/.test(config.keyEnvVar);
  const key = config.keyEnvVar && keyNameAllowed ? deps.env[config.keyEnvVar] : undefined;

  const finish = (fields: Partial<EvidenceRecord> & Pick<EvidenceRecord, "status" | "output">): EvidenceRecord => {
    const completedMs = deps.now();
    return {
      adapter: "http_endpoint",
      requestUrl: config.endpointUrl,
      requestBody,
      responseStatus,
      responseRaw,
      errorCode: null,
      errorMessage: null,
      startedAt,
      completedAt: new Date(completedMs).toISOString(),
      latencyMs: Math.max(0, Math.round(completedMs - attemptStartedMs)),
      attempts,
      ...fields,
    };
  };

  try {
    validateTargetUrl(config.endpointUrl);
    if (!isAllowedAuthHeaderName(config.authHeaderName)) {
      throw new AdapterError("invalid_configuration", "Auth header name is not allowed.");
    }
    if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 15000) {
      throw new AdapterError("invalid_configuration", "Timeout must be between 1000 and 15000 ms.");
    }
    if (!keyNameAllowed) {
      throw new AdapterError("invalid_configuration", "Key variable name must start with TARGET_KEY_.");
    }
    if (config.keyEnvVar && !key) {
      throw new AdapterError("missing_key", `Server environment variable ${config.keyEnvVar} is not set.`);
    }
    const path = responsePathFor(config);
    if (!isValidResponsePath(path)) throw new AdapterError("invalid_configuration", "Response path is not valid.");
    if (!input.trim()) throw new AdapterError("invalid_configuration", "Test input is empty.");

    requestBody = buildRequestBody(config, input);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT,
    };
    if (key) headers[config.authHeaderName.toLowerCase()] = config.authScheme ? `${config.authScheme} ${key}` : key;
    const body = JSON.stringify(requestBody);

    let response;
    for (;;) {
      attempts += 1;
      attemptStartedMs = deps.now();
      response = await deps.transport({ url: config.endpointUrl, headers, body, timeoutMs: config.timeoutMs });
      responseStatus = response.status;
      responseRaw = capText(redact(response.bodyText, key));
      if (response.status !== 429) break;
      if (attempts >= 2) throw new AdapterError("rate_limited", "Endpoint rate-limited us twice (HTTP 429).", 429);
      const waitMs = parseRetryAfter(response.headers["retry-after"], deps.now());
      if (waitMs > MAX_RETRY_AFTER_MS) {
        throw new AdapterError("rate_limited", `Endpoint asked us to wait ${Math.ceil(waitMs / 1000)} s (limit ${MAX_RETRY_AFTER_MS / 1000} s).`, 429);
      }
      await deps.sleep(waitMs);
    }

    if (response.status >= 300 && response.status < 400) {
      throw new AdapterError("redirect_blocked", `Endpoint answered with a redirect (HTTP ${response.status}); redirects are not followed.`, response.status);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new AdapterError("http_error", `Endpoint returned HTTP ${response.status}.`, response.status);
    }

    let json: unknown;
    try {
      json = JSON.parse(response.bodyText);
    } catch {
      throw new AdapterError("invalid_response", "Response was not valid JSON.");
    }
    const reply = readPath(json, path);
    if (typeof reply !== "string") {
      throw new AdapterError("invalid_response", reply === undefined ? `Response has nothing at "${path}".` : `Value at "${path}" is not text.`);
    }
    if (!reply.trim()) throw new AdapterError("invalid_response", `Reply at "${path}" is empty.`);

    return finish({ status: "completed", output: redact(reply, key) });
  } catch (error) {
    const adapterError = error instanceof AdapterError
      ? error
      : new AdapterError("network_error", "Unexpected failure while calling the endpoint.");
    return finish({
      status: "error",
      output: "",
      errorCode: adapterError.code,
      errorMessage: redact(adapterError.message, key).slice(0, 500),
    });
  }
}
