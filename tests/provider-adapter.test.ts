import assert from "node:assert/strict";
import test from "node:test";

import { HttpEndpointAdapter } from "../lib/evalgate/http-endpoint-adapter.ts";
import { ProviderAdapterError } from "../lib/evalgate/provider-adapter.ts";

test("HTTP adapter returns normalized evidence and sends idempotency metadata", async () => {
  let headers: Headers | undefined;
  const adapter = new HttpEndpointAdapter({
    name: "buyer-endpoint",
    endpointUrl: "https://example.test/evaluate",
    authorizationHeader: "Bearer secret",
    fetchImpl: async (_input, init) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({
        output: "Use human review for the refund exception.",
        request_id: "req-1",
        latency_ms: 640,
        estimated_cost_usd: 0.004,
        trace: [{ type: "tool_call", name: "policy_lookup", status: "ok" }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await adapter.execute({ promptText: "Follow policy", testInput: "Refund?", runId: "run-1", testCaseId: "case-1" });
  assert.equal(result.output, "Use human review for the refund exception.");
  assert.equal(result.latencyMs, 640);
  assert.equal(result.provider, "buyer-endpoint");
  assert.equal(headers?.get("idempotency-key"), "run-1:case-1");
  assert.equal(headers?.get("authorization"), "Bearer secret");
});

test("production endpoint must use HTTPS", () => {
  assert.throws(
    () => new HttpEndpointAdapter({ name: "bad", endpointUrl: "http://example.com/evaluate" }),
    (error: unknown) => error instanceof ProviderAdapterError && error.code === "invalid_configuration",
  );
});

test("empty output is rejected", async () => {
  const adapter = new HttpEndpointAdapter({
    name: "buyer-endpoint",
    endpointUrl: "https://example.test/evaluate",
    fetchImpl: async () => new Response(JSON.stringify({ output: "" }), { status: 200 }),
  });
  await assert.rejects(
    () => adapter.execute({ promptText: "p", testInput: "i" }),
    (error: unknown) => error instanceof ProviderAdapterError && error.code === "invalid_response",
  );
});

