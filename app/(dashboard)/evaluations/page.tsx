import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { PageHeader } from "@/components/page-header";
import { ReleaseDecisionBadge } from "@/components/release-decision-badge";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { EvalRun, EvalRunStatus } from "@/lib/evalgate/evaluations";
import type { PromptVersion } from "@/lib/evalgate/prompt-versions";
import type { ReleaseDecision } from "@/lib/evalgate/release-decisions";
import type { TestCase } from "@/lib/evalgate/test-cases";
import { createClient } from "@/lib/supabase/server";
import { runEvaluation } from "./actions";

type PromptOption = Pick<PromptVersion, "id" | "name" | "version_label" | "status">;
type TestOption = Pick<TestCase, "id" | "name" | "category" | "priority">;

const statusStyles: Record<EvalRunStatus, string> = {
  running: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  failed: "border-red-400/20 bg-red-400/10 text-red-300",
};

function LoadError({ resource }: { resource: string }) {
  return <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">Could not load {resource}. Refresh the page to try again.</div>;
}

export default async function EvaluationsPage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const supabase = createClient();
  const [promptResponse, testResponse, runResponse] = await Promise.all([
    supabase.from("prompt_versions").select("id, name, version_label, status").eq("project_id", workspace.project.id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("test_cases").select("id, name, category, priority").eq("project_id", workspace.project.id).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("eval_runs").select("id, project_id, prompt_version_id, name, status, total_tests, passed_tests, failed_tests, average_score, safety_failures, created_at, completed_at").eq("project_id", workspace.project.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const prompts = (promptResponse.data ?? []) as PromptOption[];
  const testCases = (testResponse.data ?? []) as TestOption[];
  const runs = (runResponse.data ?? []) as EvalRun[];
  const runnerReady = !promptResponse.error && !testResponse.error && prompts.length > 0 && testCases.length > 0;
  let decisions: ReleaseDecision[] = [];
  let decisionsUnavailable = false;
  if (runs.length > 0) {
    const decisionResponse = await supabase.from("release_decisions").select("id, project_id, eval_run_id, decision, total_score, reason, created_at").eq("project_id", workspace.project.id).in("eval_run_id", runs.map((run) => run.id)).order("created_at", { ascending: false });
    decisions = (decisionResponse.data ?? []) as ReleaseDecision[];
    decisionsUnavailable = Boolean(decisionResponse.error);
  }
  const decisionsByRun = new Map(decisions.map((decision) => [decision.eval_run_id, decision]));

  return <><PageHeader eyebrow="Runner" title="Evaluation runner" description="Select a prompt and active test cases, then persist a deterministically scored release-readiness run." />{searchParams.error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}<div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><form action={runEvaluation} className="panel p-6"><div className="grid gap-6"><label className="label">Run name <span className="font-normal text-slate-600">(optional)</span><input name="name" className="field" placeholder="Support prompt v1 regression run" /></label>{promptResponse.error ? <LoadError resource="prompt versions" /> : prompts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No available prompt versions. <Link href="/prompts/new" className="font-medium text-teal-400">Create one →</Link></div> : <label className="label">Prompt version<select name="prompt_version_id" className="field" defaultValue="" required><option value="" disabled>Select a prompt version</option>{prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name} · {prompt.version_label} ({prompt.status})</option>)}</select></label>}<fieldset><legend className="label">Active test cases</legend>{testResponse.error ? <div className="mt-2"><LoadError resource="active test cases" /></div> : testCases.length === 0 ? <div className="mt-2 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No active test cases. <Link href="/test-cases/new" className="font-medium text-teal-400">Create one →</Link></div> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{testCases.map((testCase) => <label key={testCase.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300 hover:border-slate-700"><input type="checkbox" name="test_case_ids" value={testCase.id} className="mt-0.5 h-4 w-4 accent-teal-400" /><span><span className="block font-medium text-slate-200">{testCase.name}</span><span className="mt-1 block text-xs capitalize text-slate-600">{testCase.category} · {testCase.priority}</span></span></label>)}</div>}</fieldset>{runnerReady && <div className="w-fit"><AuthSubmitButton idleLabel="Run simulated evaluation" pendingLabel="Saving evaluation…" /></div>}</div></form><aside className="panel h-fit p-6"><p className="eyebrow">Release readiness</p><h2 className="mt-2 font-semibold text-white">Scores become a clear decision</h2><p className="mt-3 text-sm leading-6 text-slate-400">Every completed run generates a persisted Ship, Needs Review, or Block decision from deterministic scores.</p><p className="mt-4 text-xs leading-5 text-slate-500">Safety failures always block release. Fully passing runs averaging at least 85 can ship; partial failures and mid-range scores need review.</p><p className="mt-4 border-t border-slate-800 pt-4 text-xs leading-5 text-slate-600">No real AI provider is called.</p></aside></div><section className="mt-8"><div className="mb-4"><h2 className="text-lg font-semibold text-white">Recent evaluation runs</h2><p className="mt-1 text-sm text-slate-500">The ten latest persisted runs and release decisions for this workspace.</p></div>{decisionsUnavailable && <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">Runs loaded, but release decisions are temporarily unavailable.</div>}{runResponse.error ? <LoadError resource="evaluation runs" /> : runs.length === 0 ? <div className="panel p-8 text-center text-sm text-slate-500">No evaluation runs yet.</div> : <div className="panel overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Run</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Decision</th><th className="px-5 py-4">Tests</th><th className="px-5 py-4">Pass / fail</th><th className="px-5 py-4">Average</th><th className="px-5 py-4">Safety failures</th><th className="px-5 py-4">Created</th></tr></thead><tbody className="divide-y divide-slate-800">{runs.map((run) => { const decision = decisionsByRun.get(run.id); return <tr key={run.id}><td className="max-w-64 px-5 py-4"><p className="font-medium text-slate-200">{run.name || `Evaluation ${run.id.slice(0, 8)}`}</p>{decision && <p className="mt-1 truncate text-xs text-slate-600" title={decision.reason}>{decision.reason}</p>}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[run.status]}`}>{run.status}</span></td><td className="px-5 py-4"><ReleaseDecisionBadge decision={decision?.decision} /></td><td className="px-5 py-4 text-slate-400">{run.total_tests}</td><td className="px-5 py-4 text-slate-400">{run.passed_tests} / {run.failed_tests}</td><td className="px-5 py-4 text-slate-400">{Number(run.average_score).toFixed(2)}</td><td className="px-5 py-4 text-slate-400">{run.safety_failures}</td><td className="px-5 py-4 text-slate-500">{new Date(run.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}</td></tr>; })}</tbody></table></div>}</section></>;
}
