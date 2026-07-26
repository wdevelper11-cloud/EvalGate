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

function parseSupabaseTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(
      /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(.*)$/,
      "$1T$2$3",
    )
    .replace(/\+00$/, "Z");

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function timestampToMilliseconds(value: string): number {
  return parseSupabaseTimestamp(value)?.getTime() ?? 0;
}

export function formatDateTimeIST(value: string | null | undefined): string {
  if (!value) return "Not available";

  const date = parseSupabaseTimestamp(value);
  if (!date) return "Not available";

  return `${new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(date)} IST`;
}
