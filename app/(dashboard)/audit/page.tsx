import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { formatDateTimeIST, formatScore, timestampToMilliseconds, type AuditEvent } from "@/lib/evalgate/insights";
import type { ReleaseDecisionValue } from "@/lib/evalgate/release-decisions";
import type { TestCaseCategory, TestCasePriority } from "@/lib/evalgate/test-cases";
import type { PromptVersionStatus } from "@/lib/evalgate/prompt-versions";
import { createClient } from "@/lib/supabase/server";

type TestEventRow = { id: string; name: string; category: TestCaseCategory; priority: TestCasePriority; created_at: string };
type PromptEventRow = { id: string; name: string; version_label: string; status: PromptVersionStatus; created_at: string };
type RunEventRow = { id: string; name: string | null; average_score: number; passed_tests: number; failed_tests: number; created_at: string; completed_at: string | null };
type DecisionEventRow = { id: string; eval_run_id: string; decision: ReleaseDecisionValue; reason: string; created_at: string };

const typeLabels: Record<AuditEvent["type"], string> = {
  test_case_created: "Test",
  prompt_version_created: "Prompt",
  evaluation_run_completed: "Run",
  release_decision_generated: "Decision",
};

export default async function AuditPage() {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;
  const supabase = createClient();
  const projectId = workspace.project.id;
  const [tests, prompts, runs, decisions] = await Promise.all([
    supabase.from("test_cases").select("id, name, category, priority, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
    supabase.from("prompt_versions").select("id, name, version_label, status, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
    supabase.from("eval_runs").select("id, name, average_score, passed_tests, failed_tests, created_at, completed_at").eq("project_id", projectId).eq("status", "completed").order("created_at", { ascending: false }).limit(10),
    supabase.from("release_decisions").select("id, eval_run_id, decision, reason, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10),
  ]);
  const failed = [tests, prompts, runs, decisions].some((response) => Boolean(response.error));
  const events: AuditEvent[] = [
    ...((tests.data ?? []) as TestEventRow[]).map((row): AuditEvent => ({ id: `test-${row.id}`, type: "test_case_created", title: "Test case created", description: `${row.name} · ${row.category} · ${row.priority} priority`, timestamp: row.created_at, href: "/test-cases" })),
    ...((prompts.data ?? []) as PromptEventRow[]).map((row): AuditEvent => ({ id: `prompt-${row.id}`, type: "prompt_version_created", title: "Prompt version created", description: `${row.name} · ${row.version_label} · ${row.status}`, timestamp: row.created_at, href: "/prompts" })),
    ...((runs.data ?? []) as RunEventRow[]).map((row): AuditEvent => ({ id: `run-${row.id}`, type: "evaluation_run_completed", title: "Evaluation run completed", description: `${row.name || `Evaluation ${row.id.slice(0, 8)}`} · score ${formatScore(row.average_score)} · ${row.passed_tests} passed / ${row.failed_tests} failed`, timestamp: row.completed_at ?? row.created_at, href: "/evaluations" })),
    ...((decisions.data ?? []) as DecisionEventRow[]).map((row): AuditEvent => ({ id: `decision-${row.id}`, type: "release_decision_generated", title: "Release decision generated", description: `${row.decision.replace("_", " ")} · ${row.reason}`, timestamp: row.created_at, href: "/evaluations" })),
  ].sort((a, b) => timestampToMilliseconds(b.timestamp) - timestampToMilliseconds(a.timestamp));

  return <><PageHeader eyebrow="Traceability" title="Audit Timeline" description="This timeline is derived from persisted project records. No separate audit table is used in the MVP." /><p className="mt-4 text-xs text-slate-500">Times are shown in IST for the MVP demo.</p>{failed && <section role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">Could not load the complete audit timeline. Refresh the page to try again.</section>}{events.length === 0 ? <section className="panel mt-7 p-10 text-center"><h2 className="font-semibold text-white">No audit events yet</h2><p className="mt-2 text-sm text-slate-400">Create a test case or prompt version, then run an evaluation to build the timeline.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/test-cases/new" className="button-secondary">Create test case</Link><Link href="/prompts/new" className="button-secondary">Create prompt</Link><Link href="/evaluations" className="button-primary">Run evaluation</Link></div></section> : <ol className="panel mt-7 divide-y divide-slate-800 px-6">{events.map((event) => <li className="relative py-6 pl-10" key={event.id}><span className="absolute left-0 top-6 grid h-7 w-7 place-items-center rounded-full border border-teal-400/30 bg-teal-400/10 text-[10px] font-bold text-teal-300">{typeLabels[event.type].slice(0, 1)}</span><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold text-white">{event.title}</h2><span className="rounded bg-slate-800 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500">{typeLabels[event.type]}</span></div><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{event.description}</p>{event.href && <Link href={event.href} className="mt-2 inline-block text-xs font-medium text-teal-400 hover:text-teal-300">Open related view →</Link>}</div><time dateTime={event.timestamp} className="shrink-0 text-xs text-slate-600">{formatDateTimeIST(event.timestamp)}</time></div></li>)}</ol>}</>;
}
