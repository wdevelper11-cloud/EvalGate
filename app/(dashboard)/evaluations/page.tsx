import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { PageHeader } from "@/components/page-header";
import { ReleaseDecisionBadge } from "@/components/release-decision-badge";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { evalRunFields, type EvalRun, type EvalRunStatus } from "@/lib/evalgate/evaluations";
import type { PromptVersion } from "@/lib/evalgate/prompt-versions";
import { indexReleaseDecisions, type ReleaseDecision } from "@/lib/evalgate/release-decisions";
import { MAX_CASES_PER_RUN } from "@/lib/evalgate/run-plan";
import type { TestCase } from "@/lib/evalgate/test-cases";
import { createClient } from "@/lib/supabase/server";
import { runEvaluation, startTargetRun } from "./actions";

type PromptOption = Pick<PromptVersion, "id" | "name" | "version_label" | "status">;
type TestOption = Pick<TestCase, "id" | "name" | "category" | "priority">;
type TargetOption = { id: string; name: string };

const statusStyles: Record<EvalRunStatus, string> = {
  running: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  completed: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  failed: "border-red-400/20 bg-red-400/10 text-red-300",
};

function LoadError({ resource }: { resource: string }) {
  return <div role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">Could not load {resource}. Refresh the page to try again.</div>;
}

function TestCasePicker({ testCases, error }: { testCases: TestOption[]; error: boolean }) {
  return <fieldset><legend className="label">Active test cases</legend>{error ? <div className="mt-2"><LoadError resource="active test cases" /></div> : testCases.length === 0 ? <div className="mt-2 rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No active test cases. <Link href="/test-cases/new" className="font-medium text-teal-400">Create one →</Link></div> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{testCases.map((testCase) => <label key={testCase.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-300 hover:border-slate-700"><input type="checkbox" name="test_case_ids" value={testCase.id} className="mt-0.5 h-4 w-4 accent-teal-400" /><span><span className="block font-medium text-slate-200">{testCase.name}</span><span className="mt-1 block text-xs capitalize text-slate-600">{testCase.category} · {testCase.priority}</span></span></label>)}</div>}</fieldset>;
}

export default async function EvaluationsPage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const supabase = createClient();
  const [promptResponse, testResponse, runResponse, targetResponse] = await Promise.all([
    supabase.from("prompt_versions").select("id, name, version_label, status").eq("project_id", workspace.project.id).neq("status", "archived").order("created_at", { ascending: false }),
    supabase.from("test_cases").select("id, name, category, priority").eq("project_id", workspace.project.id).eq("status", "active").order("created_at", { ascending: false }),
    supabase.from("eval_runs").select(evalRunFields).eq("project_id", workspace.project.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("targets").select("id, name").eq("project_id", workspace.project.id).order("created_at", { ascending: false }),
  ]);
  const prompts = (promptResponse.data ?? []) as PromptOption[];
  const testCases = (testResponse.data ?? []) as TestOption[];
  const runs = (runResponse.data ?? []) as unknown as EvalRun[];
  const targets = (targetResponse.data ?? []) as TargetOption[];
  const targetsById = new Map(targets.map((target) => [target.id, target]));
  const simulatedReady = !promptResponse.error && !testResponse.error && prompts.length > 0 && testCases.length > 0;
  const targetReady = !targetResponse.error && !testResponse.error && targets.length > 0 && testCases.length > 0;
  let decisions: ReleaseDecision[] = [];
  let decisionsUnavailable = false;
  if (runs.length > 0) {
    const decisionResponse = await supabase.from("release_decisions").select("id, project_id, eval_run_id, decision, total_score, reason, created_at").eq("project_id", workspace.project.id).in("eval_run_id", runs.map((run) => run.id)).order("created_at", { ascending: false });
    decisions = (decisionResponse.data ?? []) as ReleaseDecision[];
    decisionsUnavailable = Boolean(decisionResponse.error);
  }
  const decisionsByRun = indexReleaseDecisions(decisions);

  return <>
    <PageHeader eyebrow="Release gate" title="Run an evaluation" description="Send test cases to a real agent target and record exactly what it answered. The simulated mode below is a dev fixture only." />
    {searchParams.error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}

    <form action={startTargetRun} className="panel mt-7 p-6">
      <p className="eyebrow">Real agent</p>
      <h2 className="mt-2 font-semibold text-white">Test an HTTP endpoint target</h2>
      <p className="mt-1 text-sm text-slate-400">Questions go one at a time with the target&apos;s delay between them. Up to {MAX_CASES_PER_RUN} cases per run. Every reply is stored as an evidence record.</p>
      <div className="mt-6 grid gap-6">
        <label className="label">Run name <span className="font-normal text-slate-600">(optional)</span><input name="name" className="field" placeholder="My test bot, 10-question proof" /></label>
        {targetResponse.error ? <LoadError resource="targets" /> : targets.length === 0 ? <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No targets yet. <Link href="/targets/new" className="font-medium text-teal-400">Add one →</Link></div> : <label className="label">Target<select name="target_id" className="field" defaultValue="" required><option value="" disabled>Select a target</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>}
        <TestCasePicker testCases={testCases} error={Boolean(testResponse.error)} />
        {targetReady && <div className="w-fit"><AuthSubmitButton idleLabel="Create run" pendingLabel="Creating run…" /></div>}
      </div>
    </form>

    <details className="panel mt-6 p-6">
      <summary className="cursor-pointer font-semibold text-slate-300">Simulated run (dev fixture: no real agent is called)</summary>
      <p className="mt-2 text-sm text-slate-500">Scores the prompt text itself against keywords. For development only; results are labelled simulated and must never be shown to a prospect or client.</p>
      <form action={runEvaluation} className="mt-6 grid gap-6">
        <label className="label">Run name <span className="font-normal text-slate-600">(optional)</span><input name="name" className="field" placeholder="Simulated regression run" /></label>
        {promptResponse.error ? <LoadError resource="prompt versions" /> : prompts.length === 0 ? <div className="rounded-lg border border-dashed border-slate-700 p-5 text-sm text-slate-400">No available prompt versions. <Link href="/prompts/new" className="font-medium text-teal-400">Create one →</Link></div> : <label className="label">Prompt version<select name="prompt_version_id" className="field" defaultValue="" required><option value="" disabled>Select a prompt version</option>{prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name} · {prompt.version_label} ({prompt.status})</option>)}</select></label>}
        <TestCasePicker testCases={testCases} error={Boolean(testResponse.error)} />
        {simulatedReady && <div className="w-fit"><AuthSubmitButton idleLabel="Run simulated evaluation" pendingLabel="Saving evaluation…" /></div>}
      </form>
    </details>

    <section className="mt-8">
      <div className="mb-4"><h2 className="text-lg font-semibold text-white">Recent evaluation runs</h2><p className="mt-1 text-sm text-slate-500">The ten latest runs. Open a run to see each question, reply and evidence record.</p></div>
      {decisionsUnavailable && <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">Runs loaded, but release decisions are temporarily unavailable.</div>}
      {runResponse.error ? <LoadError resource="evaluation runs" /> : runs.length === 0 ? <div className="panel p-8 text-center"><h3 className="font-semibold text-white">No evaluation runs yet</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Add a target and test cases above to create your first run.</p></div> : <div className="panel overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-4">Run</th><th className="px-5 py-4">Mode</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Decision</th><th className="px-5 py-4">Tests</th><th className="px-5 py-4">Pass / fail / error</th><th className="px-5 py-4">Average</th><th className="px-5 py-4">Created</th></tr></thead><tbody className="divide-y divide-slate-800">{runs.map((run) => { const decision = decisionsByRun.get(run.id); return <tr key={run.id}><td className="max-w-64 px-5 py-4"><Link href={`/evaluations/${run.id}`} className="font-medium text-slate-200 hover:text-teal-300">{run.name || `Evaluation ${run.id.slice(0, 8)}`}</Link>{decision && <p className="mt-1 truncate text-xs text-slate-600" title={decision.reason}>{decision.reason}</p>}</td><td className="px-5 py-4 text-xs">{run.execution_mode === "http_endpoint" ? <span className="text-slate-300">HTTP · {run.target_id ? targetsById.get(run.target_id)?.name ?? "target" : "target"}</span> : <span className="rounded border border-amber-400/30 px-1.5 py-0.5 text-amber-300">Simulated · dev fixture</span>}</td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[run.status]}`}>{run.status}</span></td><td className="px-5 py-4"><ReleaseDecisionBadge decision={decision?.decision} /></td><td className="px-5 py-4 text-slate-400">{run.total_tests}</td><td className="px-5 py-4 text-slate-400">{run.passed_tests} / {run.failed_tests} / {run.errored_tests ?? 0}</td><td className="px-5 py-4 text-slate-400">{Number(run.average_score).toFixed(2)}</td><td className="px-5 py-4 text-slate-500">{new Date(run.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}</td></tr>; })}</tbody></table></div>}
    </section>
  </>;
}
