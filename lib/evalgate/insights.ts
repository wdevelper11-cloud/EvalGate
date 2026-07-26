import type { EvalRun } from "@/lib/evalgate/evaluations";
import type { PromptVersion } from "@/lib/evalgate/prompt-versions";
import type { ReleaseDecision } from "@/lib/evalgate/release-decisions";

export type ReportRun = EvalRun;
export type ReportPrompt = Pick<PromptVersion, "id" | "name" | "version_label" | "model_name">;
export type ReportDecision = ReleaseDecision;

export type AuditEvent = {
  id: string;
  type: "test_case_created" | "prompt_version_created" | "evaluation_run_completed" | "release_decision_generated";
  title: string;
  description: string;
  timestamp: string;
  href?: string;
};

export function formatScore(value: number): string {
  return Number(value).toFixed(2);
}
