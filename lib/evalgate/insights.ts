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

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export function formatDateTimeWithZone(value: string | null | undefined): string {
  const formatted = formatDateTime(value);
  return formatted === "Not available" ? formatted : `${formatted} IST`;
}
