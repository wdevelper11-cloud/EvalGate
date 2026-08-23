import { nonNegativeNumber, type EvaluationEvidence, type ExecutionMetadata, type TraceEvent } from "./provider-adapter.ts";

export type ImportedTrace = EvaluationEvidence & {
  testCaseKey: string;
  input: string;
  metadata?: ExecutionMetadata;
};

type TraceRecord = {
  test_case_key?: unknown;
  input?: unknown;
  output?: unknown;
  latency_ms?: unknown;
  estimated_cost_usd?: unknown;
  provider?: unknown;
  request_id?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  trace?: unknown;
  metadata?: unknown;
};

function textField(value: unknown, field: string, row: number): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Row ${row}: ${field} is required.`);
  return value.trim();
}

function numericField(value: unknown, field: string, row: number): number {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Row ${row}: ${field} must be a non-negative number.`);
  }
  return parsed;
}

function optionalInteger(value: unknown, field: string, row: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = numericField(value, field, row);
  if (!Number.isInteger(parsed)) throw new Error(`Row ${row}: ${field} must be an integer.`);
  return parsed;
}

function normalizeRecord(record: TraceRecord, row: number): ImportedTrace {
  if (!record || typeof record !== "object") throw new Error(`Row ${row}: trace record must be an object.`);
  const trace = record.trace === undefined ? undefined : record.trace;
  if (trace !== undefined && !Array.isArray(trace)) throw new Error(`Row ${row}: trace must be an array.`);
  const metadata = record.metadata === undefined ? undefined : record.metadata;
  if (metadata !== undefined && (!metadata || typeof metadata !== "object" || Array.isArray(metadata))) {
    throw new Error(`Row ${row}: metadata must be an object.`);
  }
  return {
    testCaseKey: textField(record.test_case_key, "test_case_key", row),
    input: textField(record.input, "input", row),
    output: textField(record.output, "output", row),
    latencyMs: numericField(record.latency_ms ?? 0, "latency_ms", row),
    estimatedCostUsd: numericField(record.estimated_cost_usd ?? 0, "estimated_cost_usd", row),
    provider: textField(record.provider ?? "recorded-trace", "provider", row),
    requestId: typeof record.request_id === "string" && record.request_id.trim() ? record.request_id.trim() : undefined,
    inputTokens: optionalInteger(record.input_tokens, "input_tokens", row),
    outputTokens: optionalInteger(record.output_tokens, "output_tokens", row),
    trace: trace as TraceEvent[] | undefined,
    metadata: metadata as ExecutionMetadata | undefined,
    raw: record as Record<string, unknown>,
  };
}

export function parseTraceJson(source: string): ImportedTrace[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Trace JSON is malformed.");
  }
  const records = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { traces?: unknown }).traces)
      ? (parsed as { traces: unknown[] }).traces
      : null;
  if (!records || records.length === 0) throw new Error("Trace JSON must contain at least one record.");
  return records.map((record, index) => normalizeRecord(record as TraceRecord, index + 1));
}

function parseCsvRows(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("Trace CSV has an unterminated quoted field.");
  row.push(field.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

export function parseTraceCsv(source: string): ImportedTrace[] {
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new Error("Trace CSV requires a header and at least one data row.");
  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const required = ["test_case_key", "input", "output"];
  for (const header of required) if (!headers.includes(header)) throw new Error(`Trace CSV is missing ${header}.`);
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2}: column count does not match header.`);
    const record = Object.fromEntries(headers.map((header, cellIndex) => [header, cells[cellIndex]])) as TraceRecord;
    return normalizeRecord(record, index + 2);
  });
}

