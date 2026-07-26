import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { EvalResult } from "@/lib/evalgate/evaluations";
import { formatDateTimeIST, formatScore } from "@/lib/evalgate/insights";
import { createClient } from "@/lib/supabase/server";

type ResultRow = EvalResult & {
  eval_runs: { name: string | null } | null;
  test_cases: { name: string } | null;
};

export default async function ResultsPage() {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("eval_results")
    .select("id, eval_run_id, test_case_id, response_output, quality_score, safety_score, format_score, latency_score, cost_score, total_score, latency_ms, estimated_cost, passed, failure_reason, forbidden_found, created_at, eval_runs!inner(name, project_id), test_cases(name)")
    .eq("eval_runs.project_id", workspace.project.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const results = (data ?? []) as unknown as ResultRow[];

  return <><PageHeader eyebrow="Evidence" title="Evaluation results" description="Inspect persisted per-test responses, dimension scores, failure reasons, and pass or fail status." />
    {error ? <section role="alert" className="panel mt-7 border-red-400/30 p-6"><h2 className="font-semibold text-white">Could not load evaluation results</h2><p className="mt-2 text-sm text-slate-400">Result evidence is temporarily unavailable. Refresh the page to try again.</p></section>
      : results.length === 0 ? <section className="panel mt-7 p-10 text-center"><h2 className="font-semibold text-white">No evaluation results yet</h2><p className="mt-2 text-sm text-slate-400">Run a prompt candidate against active test cases to generate response evidence, dimension scores, and pass or fail outcomes.</p><Link href="/evaluations" className="button-primary mt-5">Run an evaluation</Link></section>
        : <section className="mt-7 space-y-4">{results.map((result) => <article key={result.id} className="panel p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{result.eval_runs?.name || `Evaluation ${result.eval_run_id.slice(0, 8)}`}</p><h2 className="mt-2 font-semibold text-white">{result.test_cases?.name || "Test case unavailable"}</h2><p className="mt-1 text-xs text-slate-600">{formatDateTimeIST(result.created_at)}</p></div><div className="text-right"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${result.passed ? "border-teal-400/30 bg-teal-400/10 text-teal-300" : "border-red-400/30 bg-red-400/10 text-red-300"}`}>{result.passed ? "Passed" : "Failed"}</span><p className="mt-3 text-2xl font-bold text-white">{formatScore(result.total_score)}</p></div></div><p className="mt-5 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">{result.response_output}</p>{result.failure_reason && <p className="mt-4 text-sm text-red-200">{result.failure_reason}</p>}<dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800 pt-5 sm:grid-cols-5">{[["Quality", result.quality_score], ["Safety", result.safety_score], ["Format", result.format_score], ["Latency", result.latency_score], ["Cost", result.cost_score]].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wider text-slate-600">{label}</dt><dd className="mt-1 font-semibold text-slate-200">{formatScore(Number(value))}</dd></div>)}</dl></article>)}</section>}
  </>;
}
