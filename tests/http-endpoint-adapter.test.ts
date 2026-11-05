import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRequestBody,
  readPath,
  runHttpCase,
  type AdapterDeps,
  type HttpTargetConfig,
} from "../lib/evalgate/adapters/http-endpoint.ts";
import { AdapterError } from "../lib/evalgate/adapters/errors.ts";
import type { TransportRequest, TransportResponse } from "../lib/evalgate/adapters/transport.ts";

const SECRET = "sk-test-SECRET-1234567890";

const openaiTarget: HttpTargetConfig = {
  endpointUrl: "https://api.example.com/v1/chat/completions",
  requestFormat: "openai_chat",
  model: "test-model",
  authHeaderName: "Authorization",
  authScheme: "Bearer",
  keyEnvVar: "TARGET_KEY_EXAMPLE",
  timeoutMs: 15000,
};

const customTarget: HttpTargetConfig = {
  endpointUrl: "https://bot.example.com/chat",
  requestFormat: "custom_json",
  requestTemplate: { session: "proof", message: { text: "{{input}}" }, tags: ["support", "q: {{input}}"] },
  responsePath: "data.replies.0.text",
  authHeaderName: "x-api-key",
  authScheme: null,
  keyEnvVar: "TARGET_KEY_BOT",
  timeoutMs: 5000,
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): TransportResponse {
  return { status, headers, bodyText: typeof body === "string" ? body : JSON.stringify(body) };
}

function makeDeps(responses: Array<TransportResponse | AdapterError>, env: Record<string, string> = { TARGET_KEY_EXAMPLE: SECRET, TARGET_KEY_BOT: SECRET }) {
  const sent: TransportRequest[] = [];
  const sleeps: number[] = [];
  let clock = Date.parse("2026-11-05T10:00:00.000Z");
  const deps: AdapterDeps = {
    env,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    transport: async (request) => {
      sent.push(request);
      clock += 250;
      const next = responses.shift();
      if (!next) throw new Error("no more responses");
      if (next instanceof AdapterError) throw next;
      return next;
    },
  };
  return { deps, sent, sleeps };
}

test("OpenAI-compatible: sends chat body, auth header, reads choices.0.message.content", async () => {
  const { deps, sent } = makeDeps([json(200, { choices: [{ message: { content: "Refunds take 5 days." } }] })]);
  const record = await runHttpCase(openaiTarget, "How long do refunds take?", deps);

  assert.equal(record.status, "completed");
  assert.equal(record.output, "Refunds take 5 days.");
  assert.equal(record.responseStatus, 200);
  assert.equal(record.attempts, 1);
  assert.equal(record.latencyMs, 250);
  assert.deepEqual(JSON.parse(sent[0].body), { model: "test-model", messages: [{ role: "user", content: "How long do refunds take?" }] });
  assert.equal(sent[0].headers.authorization, `Bearer ${SECRET}`);
  assert.equal(sent[0].headers["user-agent"].includes("EvalGate"), false);
  assert.deepEqual(record.requestBody, JSON.parse(sent[0].body));
});

test("custom JSON: question is substituted and escaped safely, reply read from path", async () => {
  const tricky = 'He said "refund?"\nAnd {{input}} again \\ done';
  const { deps, sent } = makeDeps([json(200, { data: { replies: [{ text: "Sure." }] } })]);
  const record = await runHttpCase(customTarget, tricky, deps);

  assert.equal(record.status, "completed");
  assert.equal(record.output, "Sure.");
  const body = JSON.parse(sent[0].body);
  assert.equal(body.message.text, tricky);
  assert.equal(body.tags[1], `q: ${tricky}`);
  assert.equal(body.session, "proof");
  assert.equal(sent[0].headers["x-api-key"], SECRET);
});

test("the key never appears in the stored evidence, even if the endpoint echoes it", async () => {
  const { deps } = makeDeps([json(200, { choices: [{ message: { content: `debug key=${SECRET}` } }] })]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  const stored = JSON.stringify(record);
  assert.equal(stored.includes(SECRET), false);
  assert.match(record.output, /\[REDACTED\]/);
});

test("missing key env var: error recorded and nothing is sent", async () => {
  const { deps, sent } = makeDeps([], {});
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.status, "error");
  assert.equal(record.errorCode, "missing_key");
  assert.equal(sent.length, 0);
});

test("a key variable outside TARGET_KEY_* is never read", async () => {
  const { deps, sent } = makeDeps([], { SUPABASE_SERVICE_ROLE_KEY: "super-secret-value" });
  const record = await runHttpCase({ ...openaiTarget, keyEnvVar: "SUPABASE_SERVICE_ROLE_KEY" }, "hi", deps);
  assert.equal(record.errorCode, "invalid_configuration");
  assert.equal(sent.length, 0);
  assert.equal(JSON.stringify(record).includes("super-secret-value"), false);
});

test("missing response path is an invalid_response error with the raw body kept", async () => {
  const { deps } = makeDeps([json(200, { data: { other: 1 } })]);
  const record = await runHttpCase(customTarget, "hi", deps);
  assert.equal(record.status, "error");
  assert.equal(record.errorCode, "invalid_response");
  assert.equal(record.output, "");
  assert.equal(record.responseRaw, JSON.stringify({ data: { other: 1 } }));
});

test("non-JSON and empty replies are invalid_response", async () => {
  const notJson = await runHttpCase(openaiTarget, "hi", makeDeps([json(200, "<html>oops</html>")]).deps);
  assert.equal(notJson.errorCode, "invalid_response");
  const empty = await runHttpCase(openaiTarget, "hi", makeDeps([json(200, { choices: [{ message: { content: "  " } }] })]).deps);
  assert.equal(empty.errorCode, "invalid_response");
});

test("HTTP 500 is recorded as http_error with status, no retry", async () => {
  const { deps, sent } = makeDeps([json(500, { error: "boom" })]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.errorCode, "http_error");
  assert.equal(record.responseStatus, 500);
  assert.equal(sent.length, 1);
});

test("redirects are never followed", async () => {
  const { deps, sent } = makeDeps([json(302, "", { location: "http://169.254.169.254/latest/meta-data" })]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.errorCode, "redirect_blocked");
  assert.equal(sent.length, 1);
});

test("timeout from the transport is recorded", async () => {
  const { deps } = makeDeps([new AdapterError("timeout", "No complete response within 15000 ms.")]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.status, "error");
  assert.equal(record.errorCode, "timeout");
});

test("429 with Retry-After waits that long and retries exactly once", async () => {
  const { deps, sent, sleeps } = makeDeps([
    json(429, "slow down", { "retry-after": "3" }),
    json(200, { choices: [{ message: { content: "ok" } }] }),
  ]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.status, "completed");
  assert.deepEqual(sleeps, [3000]);
  assert.equal(sent.length, 2);
  assert.equal(record.attempts, 2);
});

test("second 429 gives up as rate_limited", async () => {
  const { deps, sent } = makeDeps([json(429, "", { "retry-after": "1" }), json(429, "")]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.errorCode, "rate_limited");
  assert.equal(sent.length, 2);
});

test("429 asking for more than 20 s is not retried", async () => {
  const { deps, sent, sleeps } = makeDeps([json(429, "", { "retry-after": "120" })]);
  const record = await runHttpCase(openaiTarget, "hi", deps);
  assert.equal(record.errorCode, "rate_limited");
  assert.equal(sent.length, 1);
  assert.deepEqual(sleeps, []);
});

test("private, local and non-https URLs are refused before sending", async () => {
  for (const endpointUrl of [
    "http://api.example.com/chat",
    "https://localhost/chat",
    "https://127.0.0.1/chat",
    "https://10.1.2.3/chat",
    "https://169.254.169.254/latest",
    "https://[::1]/chat",
    "https://[::ffff:192.168.0.1]/chat",
    "https://service.internal/chat",
    "https://user:pass@api.example.com/chat",
  ]) {
    const { deps, sent } = makeDeps([]);
    const record = await runHttpCase({ ...openaiTarget, endpointUrl }, "hi", deps);
    assert.equal(record.status, "error", endpointUrl);
    assert.ok(record.errorCode === "blocked_address" || record.errorCode === "invalid_configuration", `${endpointUrl}: ${record.errorCode}`);
    assert.equal(sent.length, 0, endpointUrl);
  }
});

test("raw response is capped", async () => {
  const big = { choices: [{ message: { content: "x".repeat(200_000) } }] };
  const record = await runHttpCase(openaiTarget, "hi", makeDeps([json(200, big)]).deps);
  assert.equal(record.status, "completed");
  assert.ok(Buffer.byteLength(record.responseRaw ?? "") < 70_000);
  assert.match(record.responseRaw ?? "", /truncated/);
});

test("custom template without {{input}} is rejected", () => {
  assert.throws(() => buildRequestBody({ ...customTarget, requestTemplate: { message: "hello" } }, "q"), AdapterError);
});

test("readPath handles arrays, missing keys and prototype names", () => {
  assert.equal(readPath({ a: [{ b: "x" }] }, "a.0.b"), "x");
  assert.equal(readPath({ a: [] }, "a.0.b"), undefined);
  assert.equal(readPath({}, "constructor"), undefined);
});
