import assert from "node:assert/strict";
import test from "node:test";

import { isStalePending, MAX_CASES_PER_RUN, nextPendingCase, STALE_PENDING_MS, summarizeRun, type StoredCaseResult } from "../lib/evalgate/run-plan.ts";
import { parseTargetForm, type TargetFormValues } from "../lib/evalgate/targets.ts";

const baseForm: TargetFormValues = {
  name: "My test bot",
  endpoint_url: "https://api.example.com/v1/chat/completions",
  request_format: "openai_chat",
  model: "test-model",
  request_template: "",
  response_path: "",
  auth_header_name: "",
  auth_scheme: "Bearer",
  key_env_var: "TARGET_KEY_MINE",
  min_delay_seconds: "",
  timeout_seconds: "",
};

test("valid OpenAI target gets safe defaults", () => {
  const parsed = parseTargetForm(baseForm);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.value.auth_header_name, "Authorization");
  assert.equal(parsed.value.min_delay_ms, 5000);
  assert.equal(parsed.value.timeout_ms, 15000);
  assert.equal(parsed.value.request_template, null);
});

test("key variable must start with TARGET_KEY_ so no other server secret can be used", () => {
  for (const key_env_var of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "target_key_x", "TARGET_KEY_"]) {
    assert.equal(parseTargetForm({ ...baseForm, key_env_var }).ok, false, key_env_var);
  }
});

test("custom JSON needs a valid template with {{input}} and a response path", () => {
  const custom = { ...baseForm, request_format: "custom_json", response_path: "data.reply" };
  assert.equal(parseTargetForm({ ...custom, request_template: "" }).ok, false);
  assert.equal(parseTargetForm({ ...custom, request_template: "{not json" }).ok, false);
  assert.equal(parseTargetForm({ ...custom, request_template: '{"q":"hello"}' }).ok, false);
  assert.equal(parseTargetForm({ ...custom, request_template: '{"q":"{{input}}"}', response_path: "" }).ok, false);
  assert.equal(parseTargetForm({ ...custom, request_template: '{"q":"{{input}}"}', response_path: "a..b" }).ok, false);
  const ok = parseTargetForm({ ...custom, request_template: '{"q":"{{input}}"}' });
  assert.ok(ok.ok);
});

test("delay and timeout limits are enforced", () => {
  assert.equal(parseTargetForm({ ...baseForm, min_delay_seconds: "1" }).ok, false);
  assert.equal(parseTargetForm({ ...baseForm, min_delay_seconds: "61" }).ok, false);
  assert.equal(parseTargetForm({ ...baseForm, timeout_seconds: "30" }).ok, false);
  const parsed = parseTargetForm({ ...baseForm, min_delay_seconds: "10", timeout_seconds: "8" });
  assert.ok(parsed.ok && parsed.value.min_delay_ms === 10000 && parsed.value.timeout_ms === 8000);
});

test("private or non-https endpoints and reserved header names are refused", () => {
  assert.equal(parseTargetForm({ ...baseForm, endpoint_url: "http://api.example.com" }).ok, false);
  assert.equal(parseTargetForm({ ...baseForm, endpoint_url: "https://192.168.0.10/chat" }).ok, false);
  assert.equal(parseTargetForm({ ...baseForm, auth_header_name: "Host" }).ok, false);
  assert.equal(parseTargetForm({ ...baseForm, auth_header_name: "Cookie" }).ok, false);
});

test("run plan resumes at the first case without a result", () => {
  assert.equal(nextPendingCase(["a", "b", "c"], ["a"]), "b");
  assert.equal(nextPendingCase(["a", "b", "c"], ["b", "a", "c"]), null);
  assert.equal(MAX_CASES_PER_RUN, 50);
});

test("an in-flight question is stale only after 90 s (then recorded as interrupted, never re-sent)", () => {
  const started = "2026-11-05T10:00:00.000Z";
  const base = Date.parse(started);
  assert.equal(isStalePending(started, base + 1000), false);
  assert.equal(isStalePending(started, base + STALE_PENDING_MS), false);
  assert.equal(isStalePending(started, base + STALE_PENDING_MS + 1), true);
  assert.equal(isStalePending(null, base), true);
});

const completed = (passed: boolean, score: number, extra: Partial<StoredCaseResult> = {}): StoredCaseResult => ({
  result_status: "completed", passed, total_score: score, forbidden_found: false, expected_count: 2, matched_count: passed ? 2 : 1, ...extra,
});
const errored: StoredCaseResult = { result_status: "error", passed: false, total_score: 0, forbidden_found: false, expected_count: 0, matched_count: 0 };

test("adapter errors are not counted as agent failures and block a Ship verdict", () => {
  const summary = summarizeRun([completed(true, 95), completed(true, 92), errored], 3);
  assert.equal(summary.status, "completed");
  assert.equal(summary.passed_tests, 2);
  assert.equal(summary.failed_tests, 0);
  assert.equal(summary.errored_tests, 1);
  assert.equal(summary.average_score, 93.5);
  assert.equal(summary.decision?.decision, "needs_review");
  assert.match(summary.decision?.reason ?? "", /1 of 3 cases could not be run/);
});

test("all cases completed and passing ships", () => {
  const summary = summarizeRun([completed(true, 95), completed(true, 90)], 2);
  assert.equal(summary.decision?.decision, "ship");
  assert.equal(summary.errored_tests, 0);
});

test("a run where every case errored is marked failed with no verdict", () => {
  const summary = summarizeRun([errored, errored], 2);
  assert.equal(summary.status, "failed");
  assert.equal(summary.decision, null);
});

test("a planned case whose test case was deleted counts as errored, so the run still finishes", () => {
  const summary = summarizeRun([completed(true, 95), completed(true, 95)], 3);
  assert.equal(summary.status, "completed");
  assert.equal(summary.errored_tests, 1);
  assert.equal(summary.decision?.decision, "needs_review");
});
