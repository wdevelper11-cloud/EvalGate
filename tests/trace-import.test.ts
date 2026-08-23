import assert from "node:assert/strict";
import test from "node:test";

import { parseTraceCsv, parseTraceJson } from "../lib/evalgate/trace-import.ts";

test("JSON wrapper imports normalized traces", () => {
  const rows = parseTraceJson(JSON.stringify({ traces: [{
    test_case_key: "refund-1",
    input: "Can I get a refund?",
    output: "Review eligibility and escalate exceptions.",
    latency_ms: 500,
    estimated_cost_usd: 0.002,
    provider: "recorded-demo",
  }] }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].testCaseKey, "refund-1");
  assert.equal(rows[0].latencyMs, 500);
});

test("CSV supports quoted commas", () => {
  const rows = parseTraceCsv('test_case_key,input,output,latency_ms,estimated_cost_usd,provider\ncase-1,"Hello, agent","Hi, human",120,0.001,demo\n');
  assert.equal(rows[0].input, "Hello, agent");
  assert.equal(rows[0].output, "Hi, human");
});

test("CSV rejects negative evidence values", () => {
  assert.throws(
    () => parseTraceCsv("test_case_key,input,output,latency_ms\ncase-1,input,output,-1\n"),
    /non-negative/,
  );
});

