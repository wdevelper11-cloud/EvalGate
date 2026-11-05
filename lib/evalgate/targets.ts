import {
  INPUT_PLACEHOLDER,
  isAllowedAuthHeaderName,
  isValidResponsePath,
  templateHasPlaceholder,
  type HttpTargetConfig,
  type RequestFormat,
} from "./adapters/http-endpoint.ts";
import { AdapterError } from "./adapters/errors.ts";
import { validateTargetUrl } from "./adapters/network-guard.ts";

export type Target = {
  id: string;
  project_id: string;
  name: string;
  adapter: "http_endpoint";
  endpoint_url: string;
  request_format: RequestFormat;
  model: string | null;
  request_template: unknown | null;
  response_path: string | null;
  auth_header_name: string;
  auth_scheme: string | null;
  key_env_var: string | null;
  min_delay_ms: number;
  timeout_ms: number;
  created_at: string;
  updated_at: string;
};

export type TargetInput = Omit<Target, "id" | "project_id" | "adapter" | "created_at" | "updated_at">;

export const targetFields =
  "id, project_id, name, adapter, endpoint_url, request_format, model, request_template, response_path, auth_header_name, auth_scheme, key_env_var, min_delay_ms, timeout_ms, created_at, updated_at";

export const KEY_ENV_VAR_PATTERN = /^TARGET_KEY_[A-Z0-9_]{1,64}$/;
export const DEFAULT_MIN_DELAY_MS = 5000;
export const DEFAULT_TIMEOUT_MS = 15000;

export type TargetFormValues = Record<
  "name" | "endpoint_url" | "request_format" | "model" | "request_template" | "response_path"
  | "auth_header_name" | "auth_scheme" | "key_env_var" | "min_delay_seconds" | "timeout_seconds",
  string
>;

export type ParseResult = { ok: true; value: TargetInput } | { ok: false; error: string };

function wholeNumber(text: string, fallback: number): number | null {
  if (!text.trim()) return fallback;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Validates the "new target" form. Pure: no network, no database. */
export function parseTargetForm(form: TargetFormValues): ParseResult {
  const name = form.name.trim();
  if (!name || name.length > 120) return { ok: false, error: "Name is required (max 120 characters)." };

  const endpoint_url = form.endpoint_url.trim();
  try {
    validateTargetUrl(endpoint_url);
  } catch (error) {
    return { ok: false, error: error instanceof AdapterError ? error.message : "Endpoint URL is invalid." };
  }
  if (endpoint_url.length > 2048) return { ok: false, error: "Endpoint URL is too long." };

  const request_format = form.request_format.trim();
  if (request_format !== "openai_chat" && request_format !== "custom_json") {
    return { ok: false, error: "Choose a request format." };
  }

  const model = form.model.trim() || null;
  if (model && model.length > 200) return { ok: false, error: "Model name is too long." };

  let request_template: unknown | null = null;
  if (request_format === "custom_json") {
    if (!form.request_template.trim()) return { ok: false, error: `Custom JSON targets need a request template containing ${INPUT_PLACEHOLDER}.` };
    try {
      request_template = JSON.parse(form.request_template);
    } catch {
      return { ok: false, error: "Request template is not valid JSON." };
    }
    if (!templateHasPlaceholder(request_template)) {
      return { ok: false, error: `Request template must contain ${INPUT_PLACEHOLDER} inside a string value.` };
    }
  }

  const response_path = form.response_path.trim() || null;
  if (request_format === "custom_json" && !response_path) return { ok: false, error: "Custom JSON targets need a response path." };
  if (response_path && (!isValidResponsePath(response_path) || response_path.length > 300)) {
    return { ok: false, error: "Response path must look like data.reply or choices.0.message.content." };
  }

  const auth_header_name = form.auth_header_name.trim() || "Authorization";
  if (!isAllowedAuthHeaderName(auth_header_name)) return { ok: false, error: "That auth header name is not allowed." };

  const auth_scheme = form.auth_scheme.trim() || null;
  if (auth_scheme && !/^[A-Za-z0-9-]{1,32}$/.test(auth_scheme)) return { ok: false, error: "Auth scheme must be a single word such as Bearer." };

  const key_env_var = form.key_env_var.trim() || null;
  if (key_env_var && !KEY_ENV_VAR_PATTERN.test(key_env_var)) {
    return { ok: false, error: "Key variable name must look like TARGET_KEY_ACME (capitals, digits, underscores)." };
  }

  const delaySeconds = wholeNumber(form.min_delay_seconds, DEFAULT_MIN_DELAY_MS / 1000);
  if (delaySeconds === null || delaySeconds < 2 || delaySeconds > 60) return { ok: false, error: "Delay between questions must be 2–60 seconds." };
  const timeoutSeconds = wholeNumber(form.timeout_seconds, DEFAULT_TIMEOUT_MS / 1000);
  if (timeoutSeconds === null || timeoutSeconds < 1 || timeoutSeconds > 15) return { ok: false, error: "Timeout must be 1–15 seconds." };

  return {
    ok: true,
    value: {
      name,
      endpoint_url,
      request_format,
      model,
      request_template,
      response_path,
      auth_header_name,
      auth_scheme,
      key_env_var,
      min_delay_ms: Math.round(delaySeconds * 1000),
      timeout_ms: Math.round(timeoutSeconds * 1000),
    },
  };
}

export function targetToConfig(target: Pick<Target, "endpoint_url" | "request_format" | "model" | "request_template" | "response_path" | "auth_header_name" | "auth_scheme" | "key_env_var" | "timeout_ms">): HttpTargetConfig {
  return {
    endpointUrl: target.endpoint_url,
    requestFormat: target.request_format,
    model: target.model,
    requestTemplate: target.request_template,
    responsePath: target.response_path,
    authHeaderName: target.auth_header_name,
    authScheme: target.auth_scheme,
    keyEnvVar: target.key_env_var,
    timeoutMs: target.timeout_ms,
  };
}
