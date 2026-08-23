import assert from "node:assert/strict";
import test from "node:test";

import { mapRecordedEvidence } from "../lib/evalgate/trace-selection.ts";

const cases = [
  { id: "case-1", name: "Refund eligibility", input: "Can I get a refund?" },
  { id: "case-2", name: "Human escalation", input: "Escalate this exception." },
];

test("recorded evidence maps every selected case by id or unique name", () => {
  const mapped = mapRecordedEvidence(JSON.stringify({ traces: [
    { test_case_key: "case-1", input: "Can I get a refund?", output: "Review the refund policy." },
    { test_case_key: "Human escalation", input: "Escalate this exception.", output: "A human reviewer is required." },
  ] }), "json", cases);
  assert.equal(mapped.size, 2);
  assert.equal(mapped.get("case-2")?.provider, "recorded-trace");
});

test("recorded evidence rejects missing selected cases", () => {
  assert.throws(() => mapRecordedEvidence(JSON.stringify([{ test_case_key: "case-1", input: "Can I get a refund?", output: "Review." }]), "json", cases), /missing 1 selected test case/);
});

test("recorded evidence rejects duplicate mappings", () => {
  assert.throws(() => mapRecordedEvidence(JSON.stringify([
    { test_case_key: "case-1", input: "Can I get a refund?", output: "Review." },
    { test_case_key: "Refund eligibility", input: "Can I get a refund?", output: "Review again." },
    { test_case_key: "case-2", input: "Escalate this exception.", output: "Escalate." },
  ]), "json", cases), /duplicate mapping/);
});

test("recorded evidence rejects input mismatch", () => {
  assert.throws(() => mapRecordedEvidence(JSON.stringify([
    { test_case_key: "case-1", input: "Different input", output: "Review." },
    { test_case_key: "case-2", input: "Escalate this exception.", output: "Escalate." },
  ]), "json", cases), /input does not match/);
});
