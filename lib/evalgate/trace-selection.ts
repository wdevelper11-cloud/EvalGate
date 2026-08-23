import { parseTraceCsv, parseTraceJson, type ImportedTrace } from "./trace-import.ts";

export type TraceSelectableCase = { id: string; name: string; input: string };

export function mapRecordedEvidence(
  traceSource: string,
  traceFormat: string,
  testCases: TraceSelectableCase[],
  maxCharacters = 200_000,
): Map<string, ImportedTrace> {
  if (!traceSource) throw new Error("Recorded trace content is required.");
  if (traceSource.length > maxCharacters) throw new Error(`Recorded trace content exceeds the ${maxCharacters.toLocaleString("en-US")}-character limit.`);
  const imported = traceFormat === "csv" ? parseTraceCsv(traceSource) : traceFormat === "json" ? parseTraceJson(traceSource) : null;
  if (!imported) throw new Error("Recorded trace format must be JSON or CSV.");

  const selectedById = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  const selectedByName = new Map<string, TraceSelectableCase>();
  for (const testCase of testCases) {
    if (selectedByName.has(testCase.name)) throw new Error(`Recorded trace cannot use duplicate test name: ${testCase.name}. Use test-case IDs.`);
    selectedByName.set(testCase.name, testCase);
  }

  const evidenceByCase = new Map<string, ImportedTrace>();
  for (const evidence of imported) {
    const testCase = selectedById.get(evidence.testCaseKey) ?? selectedByName.get(evidence.testCaseKey);
    if (!testCase) throw new Error(`Recorded trace key is not a selected test case: ${evidence.testCaseKey}.`);
    if (evidenceByCase.has(testCase.id)) throw new Error(`Recorded trace contains a duplicate mapping for ${testCase.name}.`);
    if (evidence.input.trim() !== testCase.input.trim()) throw new Error(`Recorded trace input does not match the selected case: ${testCase.name}.`);
    evidenceByCase.set(testCase.id, evidence);
  }

  const missing = testCases.filter((testCase) => !evidenceByCase.has(testCase.id));
  if (missing.length > 0) throw new Error(`Recorded trace is missing ${missing.length} selected test case${missing.length === 1 ? "" : "s"}.`);
  return evidenceByCase;
}
