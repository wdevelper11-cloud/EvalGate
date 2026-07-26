import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ReleaseDecisionBadge } from "@/components/release-decision-badge";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { ReleaseDecision } from "@/lib/evalgate/release-decisions";
import { createClient } from "@/lib/supabase/server";

type RunMetric = { average_score: number; safety_failures: number };

export default async function DashboardPage() {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;
  const supabase = createClient();
  const projectId = workspace.project.id;
  const [tests, activeTests, prompts, activePrompts, runs, completedRuns, blocked, latest] = await Promise.all([
    supabase.from("test_cases").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("test_cases").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "active"),
    supabase.from("prompt_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("prompt_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "active"),
    supabase.from("eval_runs").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("eval_runs").select("average_score, safety_failures").eq("project_id", projectId).eq("status", "completed"),
    supabase.from("release_decisions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("decision", "block"),
    supabase.from("release_decisions").select("id, project_id, eval_run_id, decision, total_score, reason, created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const failed = [tests, activeTests, prompts, activePrompts, runs, completedRuns, blocked, latest].some((response) => Boolean(response.error));
  const completed = (completedRuns.data ?? []) as RunMetric[];
  const average = completed.length ? completed.reduce((sum, run) => sum + Number(run.average_score), 0) / completed.length : 0;
  const safetyFailures = completed.reduce((sum, run) => sum + run.safety_failures, 0);
  const decision = latest.data as ReleaseDecision | null;
  const metrics = [
    ["Total test cases", String(tests.count ?? 0)], ["Active test cases", String(activeTests.count ?? 0)],
    ["Prompt versions", String(prompts.count ?? 0)], ["Active prompt versions", String(activePrompts.count ?? 0)],
    ["Total evaluation runs", String(runs.count ?? 0)], ["Average score", average.toFixed(2)],
    ["Safety failures", String(safetyFailures)], ["Blocked releases", String(blocked.count ?? 0)],
  ] as const;

  return <><PageHeader eyebrow="Overview" title="Release readiness dashboard" description="Live project-scoped coverage, quality, safety, and release evidence." /><section className="panel mt-7 p-6"><p className="eyebrow">Workspace</p><div className="mt-3 grid gap-5 sm:grid-cols-2"><div><h2 className="text-lg font-semibold text-white">{workspace.project.name}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{workspace.project.description}</p></div><div className="sm:text-right"><p className="text-xs uppercase tracking-wider text-slate-500">Signed in as</p><p className="mt-2 text-sm font-medium text-slate-200">{workspace.email}</p></div></div></section>{failed && <section role="alert" className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><strong>Could not load dashboard metrics.</strong> Some values may show safe fallbacks; refresh to try again.</section>}<section aria-label="Live evaluation metrics" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label, value]) => <MetricCard key={label} label={label} value={value} detail="Live Supabase project data" />)}</section><section className="panel mt-6 p-6"><p className="eyebrow">Latest release readiness</p><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><ReleaseDecisionBadge decision={decision?.decision} /><p className="mt-3 max-w-3xl text-sm text-slate-400">{decision?.reason ?? "Run an evaluation to generate the first release decision."}</p></div><p className="text-2xl font-bold text-white">{decision ? Number(decision.total_score).toFixed(2) : "—"}</p></div></section><nav aria-label="Workspace shortcuts" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Test cases", "/test-cases"], ["Prompt versions", "/prompts"], ["Run evaluation", "/evaluations"], ["View reports", "/reports"]].map(([label, href]) => <Link key={href} href={href} className="button-secondary">{label} →</Link>)}</nav></>;
}
