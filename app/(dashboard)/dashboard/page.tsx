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
    ["Active test coverage", String(activeTests.count ?? 0), `${tests.count ?? 0} total test cases`],
    ["Active prompt candidates", String(activePrompts.count ?? 0), `${prompts.count ?? 0} saved versions`],
    ["Completed evaluations", String(completed.length), `${runs.count ?? 0} total runs`],
    ["Average readiness score", completed.length ? average.toFixed(1) : "—", completed.length ? "Across completed evaluations" : "Run an evaluation to establish a baseline"],
    ["Safety failures", String(safetyFailures), "Across completed evaluations"],
    ["Blocked releases", String(blocked.count ?? 0), "Release decisions requiring action"],
  ] as const;

  const steps = [
    ["1", "Build test coverage", "Define expected behavior and release-blocking safety terms.", "/test-cases", "Manage test cases"],
    ["2", "Register a candidate", "Save the exact prompt version you want to validate.", "/prompts", "Manage prompts"],
    ["3", "Run the release gate", "Select active tests and generate deterministic evidence.", "/evaluations", "Start evaluation"],
    ["4", "Review the decision", "Inspect score rationale, reports, and traceable activity.", "/reports", "Review reports"],
  ] as const;

  return <><PageHeader eyebrow="Overview" title="Release readiness dashboard" description="Monitor evaluation coverage, completed run health, safety signals, and the latest go/no-go decision for this workspace." /><section className="panel mt-7 p-6"><p className="eyebrow">Workspace</p><div className="mt-3 grid gap-5 sm:grid-cols-2"><div><h2 className="text-lg font-semibold text-white">{workspace.project.name}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{workspace.project.description}</p></div><div className="sm:text-right"><p className="text-xs uppercase tracking-wider text-slate-500">Signed in as</p><p className="mt-2 text-sm font-medium text-slate-200">{workspace.email}</p></div></div></section>{failed && <section role="alert" className="mt-6 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200"><strong>Some dashboard data is temporarily unavailable.</strong> Refresh the page before using these metrics for a release review.</section>}<section aria-label="Live evaluation metrics" className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value, detail]) => <MetricCard key={label} label={label} value={value} detail={detail} />)}</section><section className="panel mt-6 overflow-hidden"><div className="border-b border-slate-800 p-6"><p className="eyebrow">Latest release decision</p><p className="mt-2 text-sm text-slate-500">The most recent persisted outcome from your deterministic release gate.</p></div><div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between"><div><ReleaseDecisionBadge decision={decision?.decision} /><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">{decision?.reason ?? "No decision yet. Add an active test case and prompt version, then complete your first evaluation."}</p></div><div className="shrink-0 sm:text-right"><p className="text-xs uppercase tracking-wider text-slate-600">Readiness score</p><p className="mt-1 text-3xl font-bold text-white">{decision ? Number(decision.total_score).toFixed(1) : "—"}</p></div></div></section><section className="mt-8"><p className="eyebrow">Recommended workflow</p><h2 className="mt-2 text-lg font-semibold text-white">Move from scenario to release decision</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{steps.map(([number, title, body, href, action]) => <article key={number} className="panel flex flex-col p-5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-400/10 text-xs font-bold text-teal-300">{number}</span><h3 className="mt-4 font-semibold text-white">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{body}</p><Link href={href} className="mt-5 text-sm font-semibold text-teal-400 hover:text-teal-300">{action} →</Link></article>)}</div></section></>;
}
