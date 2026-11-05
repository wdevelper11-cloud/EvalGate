export type AdapterErrorCode =
  | "invalid_configuration"
  | "missing_key"
  | "blocked_address"
  | "dns_error"
  | "timeout"
  | "network_error"
  | "redirect_blocked"
  | "http_error"
  | "rate_limited"
  | "response_too_large"
  | "invalid_response";

export class AdapterError extends Error {
  readonly code: AdapterErrorCode;
  readonly status?: number;

  constructor(code: AdapterErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AdapterError";
    this.code = code;
    this.status = status;
  }
}
