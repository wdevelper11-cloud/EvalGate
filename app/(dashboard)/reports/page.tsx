import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { ReleaseDecisionBadge } from "@/components/release-decision-badge";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { formatDateTime, formatScore, type ReportDecision, type ReportPrompt, type ReportRun } from "@/lib/evalgate/insights";
import { createClient } from "@/lib/supabase/server";

function ReportsError() {
  return <section role="alert" className="panel mt-7 border-red-400/30 p-6"><h2 className="font-semibold text-white">Could not load reports</h2><p className="mt-2 text-sm text-slate-400">Release evidence is temporarily unavailable. Refresh the page to try again.</p></section>;
}

export default async function ReportsPage() {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;
  const supabase = createClient();
  const { data: runData, error: runError } = await supabase.from("eval_runs").select("id, project_id, prompt_version_id, name, status, total_tests, passed_tests, failed_tests, average_score, safety_failures, created_at, completed_at").eq("project_id", workspace.project.id).eq("status", "completed").order("created_at", { ascending: false }).limit(20);
  const runs = (runData ?? []) as ReportRun[];

  if (runError) return <><PageHeader eyebrow="Evidence" title="Release Readiness Report" description={workspace.project.name} /><ReportsError /></>;
  if (runs.length === 0) return <><PageHeader eyebrow="Evidence" title="Release Readiness Report" description={`${workspace.project.name} · This report summarizes persisted evaluation runs, deterministic scores, and release decisions.`} /><section className="panel mt-7 p-10 text-center"><h2 className="font-semibold text-white">No evaluation reports yet</h2><p className="mt-2 text-sm text-slate-400">Reports appear after you complete a simulated evaluation.</p><Link href="/evaluations" className="button-primary mt-5">Run an evaluation</Link></section></>;

  const runIds = runs.map((run) => run.id);
  const promptIds = Array.from(new Set(runs.map((run) => run.prompt_version_id)));
  const [decisionResponse, promptResponse] = await Promise.all([
    supabase.from("release_decisions").select("id, project_id, eval_run_id, decision, total_score, reason, created_at").eq("project_id", workspace.project.id).in("eval_run_id", runIds).order("created_at", { ascending: false }),
    supabase.from("prompt_versions").select("id, name, version_label, model_name").eq("project_id", workspace.project.id).in("id", promptIds),
  ]);
  if (decisionResponse.error || promptResponse.error) return <><PageHeader eyebrow="Evidence" title="Release Readiness Report" description={workspace.project.name} /><ReportsError /></>;
  const decisions = (decisionResponse.data ?? []) as ReportDecision[];
  const prompts = (promptResponse.data ?? []) as ReportPrompt[];
  const decisionsByRun = new Map(decisions.map((decision) => [decision.eval_run_id, decision]));
  const promptsById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const average = runs.reduce((sum, run) => sum + Number(run.average_score), 0) / runs.length;
  const safetyFailures = runs.reduce((sum, run) => sum + run.safety_failures, 0);
  const countDecision = (value: ReportDecision["decision"]) => decisions.filter((decision) => decision.decision === value).length;
  const summaries = [["Total runs", String(runs.length)], ["Ship decisions", String(countDecision("ship"))], ["Needs review", String(countDecision("needs_review"))], ["Block decisions", String(countDecision("block"))], ["Average score", formatScore(average)], ["Safety failures", String(safetyFailures)]] as const;

  return <><PageHeader eyebrow="Evidence" title="Release Readiness Report" description={`${workspace.project.name} · This report summarizes persisted evaluation runs, deterministic scores, and release decisions.`} /><section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{summaries.map(([label, value]) => <MetricCard key={label} label={label} value={value} detail="Recent completed runs" />)}</section><section className="mt-8"><h2 className="text-lg font-semibold text-white">Recent release decisions</h2>{decisions.length === 0 ? <div className="panel mt-4 p-6 text-sm text-slate-500">These completed runs do not have persisted release decisions yet.</div> : <div className="mt-4 grid gap-4 lg:grid-cols-2">{decisions.map((decision) => { const run = runs.find((item) => item.id === decision.eval_run_id); const prompt = run ? promptsById.get(run.prompt_version_id) : undefined; return <article key={decision.id} className="panel p-6"><div className="flex items-center justify-between gap-4"><ReleaseDecisionBadge decision={decision.decision} /><span className="text-xl font-bold text-white">{formatScore(decision.total_score)}</span></div><h3 className="mt-4 font-semibold text-white">{run?.name || `Evaluation ${decision.eval_run_id.slice(0, 8)}`}</h3><p className="mt-1 text-xs text-slate-500">{prompt ? `${prompt.name} · ${prompt.version_label} · ${prompt.model_name}` : "Prompt unavailable"}</p><p className="mt-4 text-sm leading-6 text-slate-400">{decision.reason}</p>{run && <p className="mt-4 text-xs text-slate-600">{run.total_tests} tests · {run.passed_tests} passed · {run.failed_tests} failed · {run.safety_failures} safety failures · {formatDateTime(decision.created_at)}</p>}</article>; })}</div>}</section><section className="mt-8"><h2 className="text-lg font-semibold text-white">Run quality</h2><div className="panel mt-4 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Run</th><th className="px-5 py-4">Prompt</th><th className="px-5 py-4">Average</th><th className="px-5 py-4">Pass / fail</th><th className="px-5 py-4">Safety</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Completed</th></tr></thead><tbody className="divide-y divide-slate-800">{runs.map((run) => { const prompt = promptsById.get(run.prompt_version_id); const decision = decisionsByRun.get(run.id); return <tr key={run.id}><td className="px-5 py-4"><p className="font-medium text-slate-200">{run.name || `Evaluation ${run.id.slice(0, 8)}`}</p>{decision && <div className="mt-2"><ReleaseDecisionBadge decision={decision.decision} /></div>}</td><td className="px-5 py-4 text-slate-400">{prompt ? `${prompt.name} · ${prompt.version_label}` : "Unavailable"}</td><td className="px-5 py-4 text-slate-400">{formatScore(run.average_score)}</td><td className="px-5 py-4 text-slate-400">{run.passed_tests} / {run.failed_tests}</td><td className="px-5 py-4 text-slate-400">{run.safety_failures}</td><td className="px-5 py-4 capitalize text-slate-400">{run.status}</td><td className="px-5 py-4 text-slate-500">{formatDateTime(run.completed_at)}</td></tr>; })}</tbody></table></div></section></>;
}
