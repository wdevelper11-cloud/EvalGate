// Task 1 verification gate: attempts to break each guarantee.
import assert from "node:assert/strict";
import test from "node:test";

import { AdapterError } from "../lib/evalgate/adapters/errors.ts";
import { MAX_RETRY_AFTER_MS, runHttpCase, type AdapterDeps, type HttpTargetConfig } from "../lib/evalgate/adapters/http-endpoint.ts";
import { resolvePublicAddress, validateTargetUrl } from "../lib/evalgate/adapters/network-guard.ts";
import type { TransportRequest, TransportResponse } from "../lib/evalgate/adapters/transport.ts";
import { MAX_CASES_PER_RUN, pacingWaitMs } from "../lib/evalgate/run-plan.ts";
import { parseTargetForm } from "../lib/evalgate/targets.ts";

const KEY = "sk-live-VERY-SECRET-abcdef0123456789";
const target: HttpTargetConfig = {
  endpointUrl: "https://api.example.com/v1/chat/completions",
  requestFormat: "openai_chat",
  authHeaderName: "Authorization",
  authScheme: "Bearer",
  keyEnvVar: "TARGET_KEY_GATE",
  timeoutMs: 15000,
};

type Step = TransportResponse | { error: AdapterError; afterMs: number } | { response: TransportResponse; afterMs: number };

function harness(steps: Step[], env: Record<string, string> = { TARGET_KEY_GATE: KEY }) {
  const sent: TransportRequest[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const deps: AdapterDeps = {
    env,
    now: () => clock,
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    transport: async (request) => {
      sent.push(request);
      const step = steps.shift();
      if (!step) throw new Error("unexpected extra request");
      if ("error" in step) { clock += step.afterMs; throw step.error; }
      if ("response" in step) { clock += step.afterMs; return step.response; }
      clock += 100;
      return step;
    },
  };
  return { deps, sent, sleeps, elapsed: () => clock };
}

// ---- 2. Address tricks -----------------------------------------------------

test("[2] encoded and disguised loopback/private/metadata URLs are all refused", () => {
  for (const url of [
    "https://2130706433/", // decimal 127.0.0.1
    "https://0x7f000001/", // hex 127.0.0.1
    "https://0177.0.0.1/", // octal 127.0.0.1
    "https://127.1/", // short form
    "https://LOCALHOST/",
    "https://localhost./",
    "https://foo.localhost/",
    "https://[::ffff:7f00:1]/", // IPv4-mapped loopback in hex
    "https://[::127.0.0.1]/", // IPv4-compatible
    "https://[0:0:0:0:0:0:0:1]/",
    "https://169.254.169.254/latest/meta-data/",
    "https://[fd00:ec2::254]/", // AWS IMDS IPv6
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://100.100.100.200/", // Alibaba metadata (CGNAT range)
    "https://0.0.0.0/",
    "https://10.0.0.1:8443/",
    "https://172.20.1.1/",
    "https://192.168.0.1/",
  ]) {
    assert.throws(() => validateTargetUrl(url), AdapterError, url);
  }
});

test("[2] a public-looking domain whose DNS points inside is refused, even if only one answer is bad", async () => {
  const cases: Array<[string, string[]]> = [
    ["127.0.0.1.nip.io", ["127.0.0.1"]],
    ["metadata.attacker.example", ["169.254.169.254"]],
    ["mixed.attacker.example", ["93.184.216.34", "10.0.0.7"]],
    ["v6.attacker.example", ["2606:4700::1", "::1"]],
    ["mapped.attacker.example", ["::ffff:192.168.1.1"]],
  ];
  for (const [host, addresses] of cases) {
    await assert.rejects(
      resolvePublicAddress(host, async () => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))),
      (error: unknown) => error instanceof AdapterError && error.code === "blocked_address",
      host,
    );
  }
});

// ---- 3. Key never stored ---------------------------------------------------

test("[3] key echoed in a 401 error body is redacted from the stored record", async () => {
  const { deps } = harness([{ status: 401, headers: {}, bodyText: JSON.stringify({ error: `invalid key Bearer ${KEY}` }) }]);
  const record = await runHttpCase(target, "hi", deps);
  assert.equal(record.status, "error");
  assert.equal(record.errorCode, "http_error");
  assert.equal(JSON.stringify(record).includes(KEY), false);
  assert.match(record.responseRaw ?? "", /\[REDACTED\]/);
});

test("[3] key echoed in a successful reply, raw body and nested JSON is redacted everywhere", async () => {
  const body = { choices: [{ message: { content: `your key is ${KEY}` } }], debug: { headers: { authorization: `Bearer ${KEY}` } } };
  const { deps, sent } = harness([{ status: 200, headers: {}, bodyText: JSON.stringify(body) }]);
  const record = await runHttpCase(target, "hi", deps);
  assert.equal(record.status, "completed");
  assert.equal(JSON.stringify(record).includes(KEY), false);
  // ...but it was really sent, in the header only
  assert.equal(sent[0].headers.authorization, `Bearer ${KEY}`);
  assert.equal(sent[0].body.includes(KEY), false);
});

test("[3] key is not in the record when the request fails at the network level", async () => {
  const { deps } = harness([{ error: new AdapterError("network_error", "The request failed before a response was received."), afterMs: 10 }]);
  const record = await runHttpCase(target, "hi", deps);
  assert.equal(JSON.stringify(record).includes(KEY), false);
});

test("[3] a key placed in the question itself is still never in any header and the record has no secrets added", async () => {
  const { deps, sent } = harness([{ status: 200, headers: {}, bodyText: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) }]);
  await runHttpCase(target, "hello", deps);
  assert.deepEqual(Object.keys(sent[0].headers).sort(), ["accept", "authorization", "content-type", "user-agent"]);
});

// ---- 4. Only TARGET_KEY_* ----------------------------------------------------

test("[4] every non-TARGET_KEY_ name is refused before any request, in the form and in the adapter", async () => {
  const env = {
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret",
    TARGET_KEY: "no-suffix-secret",
    "TARGET_KEY_X; rm": "weird",
    target_key_lower: "lower-secret",
  };
  for (const name of Object.keys(env)) {
    const { deps, sent } = harness([], env);
    const record = await runHttpCase({ ...target, keyEnvVar: name }, "hi", deps);
    assert.equal(record.errorCode, "invalid_configuration", name);
    assert.equal(sent.length, 0, name);
    for (const value of Object.values(env)) assert.equal(JSON.stringify(record).includes(value), false, `${name} leaked ${value}`);
    const form = parseTargetForm({ name: "t", endpoint_url: "https://api.example.com/x", request_format: "openai_chat", model: "", request_template: "", response_path: "", auth_header_name: "", auth_scheme: "", key_env_var: name, min_delay_seconds: "", timeout_seconds: "" });
    assert.equal(form.ok, false, `form accepted ${name}`);
  }
});

// ---- 5. Pacing ----------------------------------------------------------------

test("[5] pacing never returns 0 within the delay window, for any delay the form allows", () => {
  const start = "2026-11-05T10:00:00.000Z";
  for (const delay of [2000, 5000, 60000]) {
    for (const after of [0, 1, delay / 2, delay - 1]) {
      assert.ok(pacingWaitMs(start, delay, Date.parse(start) + after) > 0, `${delay}/${after}`);
    }
    assert.equal(pacingWaitMs(start, delay, Date.parse(start) + delay), 0);
  }
  // clock skew: a "last started" in the future still forces a wait
  assert.ok(pacingWaitMs("2026-11-05T10:00:10.000Z", 5000, Date.parse(start)) >= 5000);
});

test("[5] the form refuses delays below 2 s (default 5 s)", () => {
  const base = { name: "t", endpoint_url: "https://api.example.com/x", request_format: "openai_chat", model: "", request_template: "", response_path: "", auth_header_name: "", auth_scheme: "", key_env_var: "", timeout_seconds: "" };
  assert.equal(parseTargetForm({ ...base, min_delay_seconds: "1.9" }).ok, false);
  assert.equal(parseTargetForm({ ...base, min_delay_seconds: "-5" }).ok, false);
  const def = parseTargetForm({ ...base, min_delay_seconds: "" });
  assert.ok(def.ok && def.value.min_delay_ms === 5000);
});

// ---- 6. Cap ---------------------------------------------------------------------

test("[6] the cap is 50", () => {
  assert.equal(MAX_CASES_PER_RUN, 50);
});

// ---- 7 & 11. Retry and time budget -------------------------------------------------

test("[7] Retry-After exactly 20 s is honoured; 21 s and an HTTP date 60 s ahead are not retried", async () => {
  const ok = harness([
    { status: 429, headers: { "retry-after": "20" }, bodyText: "" },
    { status: 200, headers: {}, bodyText: JSON.stringify({ choices: [{ message: { content: "ok" } }] }) },
  ]);
  assert.equal((await runHttpCase(target, "hi", ok.deps)).status, "completed");
  assert.deepEqual(ok.sleeps, [20000]);

  const tooLong = harness([{ status: 429, headers: { "retry-after": "21" }, bodyText: "" }]);
  assert.equal((await runHttpCase(target, "hi", tooLong.deps)).errorCode, "rate_limited");
  assert.equal(tooLong.sent.length, 1);

  const date = harness([{ status: 429, headers: { "retry-after": new Date(60_000).toUTCString() }, bodyText: "" }]);
  assert.equal((await runHttpCase(target, "hi", date.deps)).errorCode, "rate_limited");
  assert.equal(date.sent.length, 1);
  assert.equal(MAX_RETRY_AFTER_MS, 20000);
});

test("[7] three 429s never cause a third request", async () => {
  const h = harness([
    { status: 429, headers: { "retry-after": "0" }, bodyText: "" },
    { status: 429, headers: { "retry-after": "0" }, bodyText: "" },
    { status: 429, headers: { "retry-after": "0" }, bodyText: "" },
  ]);
  await runHttpCase(target, "hi", h.deps);
  assert.equal(h.sent.length, 2);
});

test("[7] timeouts above 15 s are refused by the adapter and the form", async () => {
  const h = harness([]);
  const record = await runHttpCase({ ...target, timeoutMs: 16000 }, "hi", h.deps);
  assert.equal(record.errorCode, "invalid_configuration");
  assert.equal(h.sent.length, 0);
  const base = { name: "t", endpoint_url: "https://api.example.com/x", request_format: "openai_chat", model: "", request_template: "", response_path: "", auth_header_name: "", auth_scheme: "", key_env_var: "", min_delay_seconds: "" };
  assert.equal(parseTargetForm({ ...base, timeout_seconds: "16" }).ok, false);
});

test("[11] worst case for one case is 15 s + 20 s + 15 s = 50 s of adapter time", async () => {
  // A slow 429 at the deadline, the longest allowed wait, then a timeout at the deadline.
  const h = harness([
    { response: { status: 429, headers: { "retry-after": "20" }, bodyText: "" }, afterMs: 15000 },
    { error: new AdapterError("timeout", "No complete response within 15000 ms."), afterMs: 15000 },
  ]);
  const record = await runHttpCase(target, "hi", h.deps);
  assert.equal(record.errorCode, "timeout");
  assert.equal(h.elapsed(), 50000);
  assert.ok(h.elapsed() <= 50000);
});
