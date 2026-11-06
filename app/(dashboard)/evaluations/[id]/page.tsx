import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { ReleaseDecisionBadge } from "@/components/release-decision-badge";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { evalRunFields, executionModeLabels, type EvalResult, type EvalRun } from "@/lib/evalgate/evaluations";
import { formatDateTimeIST } from "@/lib/evalgate/insights";
import type { ReleaseDecision } from "@/lib/evalgate/release-decisions";
import { createClient } from "@/lib/supabase/server";
import { RunController } from "./run-controller";

// Each server action call from this page sends at most one question (timeout ≤ 15 s, one 429 retry ≤ 20 s).
export const maxDuration = 60;

const resultFields = "id, eval_run_id, test_case_id, response_output, total_score, latency_ms, passed, failure_reason, forbidden_found, created_at, execution_source, result_status, adapter, request_url, request_body, response_status, response_raw, error_code, error_message, started_at, completed_at";

function Evidence({ result }: { result: Partial<EvalResult> }) {
  return (
    <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs">
      <summary className="cursor-pointer font-medium text-slate-300">Evidence record</summary>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <div><dt className="text-slate-600">Adapter</dt><dd className="text-slate-300">{result.adapter}</dd></div>
        <div><dt className="text-slate-600">HTTP status</dt><dd className="text-slate-300">{result.response_status ?? "—"}</dd></div>
        <div><dt className="text-slate-600">Started</dt><dd className="text-slate-300">{result.started_at ?? "—"}</dd></div>
        <div><dt className="text-slate-600">Completed</dt><dd className="text-slate-300">{result.completed_at ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-600">URL</dt><dd className="break-all font-mono text-slate-300">{result.request_url}</dd></div>
      </dl>
      <p className="mt-3 text-slate-600">Exact request body sent</p>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 font-mono text-slate-300">{JSON.stringify(result.request_body, null, 2)}</pre>
      <p className="mt-3 text-slate-600">Raw response received</p>
      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-black/40 p-3 font-mono text-slate-300">{result.response_raw ?? "—"}</pre>
    </details>
  );
}

export default async function RunPage({ params }: { params: { id: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;
  const supabase = createClient();

  const { data: runData } = await supabase.from("eval_runs").select(evalRunFields).eq("id", params.id).eq("project_id", workspace.project.id).maybeSingle();
  if (!runData) notFound();
  const run = runData as EvalRun;
  // Runs created before patch 002 have no plan; fall back to whatever results exist.
  let caseIds = run.planned_test_case_ids ?? [];
  if (caseIds.length === 0) {
    const { data: legacy } = await supabase.from("eval_results").select("test_case_id").eq("eval_run_id", run.id);
    caseIds = ((legacy ?? []) as Array<{ test_case_id: string }>).map((row) => row.test_case_id);
  }

  const [targetResponse, caseResponse, resultResponse, decisionResponse] = await Promise.all([
    run.target_id ? supabase.from("targets").select("name, endpoint_url").eq("id", run.target_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("test_cases").select("id, name, input").eq("project_id", workspace.project.id).in("id", caseIds),
    supabase.from("eval_results").select(resultFields).eq("eval_run_id", run.id),
    supabase.from("release_decisions").select("id, project_id, eval_run_id, decision, total_score, reason, created_at").eq("eval_run_id", run.id).maybeSingle(),
  ]);
  const target = targetResponse.data as { name: string; endpoint_url: string } | null;
  const cases = new Map(((caseResponse.data ?? []) as Array<{ id: string; name: string; input: string }>).map((testCase) => [testCase.id, testCase]));
  const results = new Map(((resultResponse.data ?? []) as unknown as EvalResult[]).map((result) => [result.test_case_id, result]));
  const decision = decisionResponse.data as ReleaseDecision | null;

  return <>
    <PageHeader eyebrow={executionModeLabels[run.execution_mode]} title={run.name || `Run ${run.id.slice(0, 8)}`} description={target ? `Target: ${target.name} · ${target.endpoint_url}` : "Simulated run: no real agent was called."} />
    <section className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
      <span className="capitalize">Status: <strong className="text-slate-200">{run.status}</strong></span>
      <span>{Array.from(results.values()).filter((result) => result.result_status !== "pending").length} of {caseIds.length} done</span>
      {run.status !== "running" && <span>{run.passed_tests} passed · {run.failed_tests} failed · {run.errored_tests} errored</span>}
      {decision && <ReleaseDecisionBadge decision={decision.decision} />}
      <Link href="/evaluations" className="text-teal-400 hover:text-teal-300">All runs →</Link>
    </section>
    {decision && <p className="mt-3 text-sm text-slate-500">{decision.reason}</p>}
    {run.execution_mode === "http_endpoint" && <RunController runId={run.id} initiallyRunning={run.status === "running"} />}
    <section className="mt-8 space-y-4">
      {caseIds.map((caseId, index) => {
        const testCase = cases.get(caseId);
        const result = results.get(caseId);
        const badge = !result ? ["Not sent", "border-slate-700 text-slate-400"]
          : result.result_status === "pending" ? ["Sending…", "border-sky-400/30 bg-sky-400/10 text-sky-200"]
          : result.result_status === "error" ? ["Error (not an agent failure)", "border-amber-400/30 bg-amber-400/10 text-amber-200"]
            : result.passed ? ["Passed", "border-teal-400/30 bg-teal-400/10 text-teal-300"] : ["Failed", "border-red-400/30 bg-red-400/10 text-red-300"];
        return <article key={caseId} className="panel p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs text-slate-600">Case {index + 1}</p><h2 className="mt-1 font-semibold text-white">{testCase?.name ?? "Test case unavailable"}</h2></div>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge[1]}`}>{badge[0]}</span>
          </div>
          <p className="mt-4 text-xs uppercase tracking-wider text-slate-600">Question sent</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{testCase?.input}</p>
          {result && result.result_status !== "pending" && <>
            <p className="mt-4 text-xs uppercase tracking-wider text-slate-600">{result.result_status === "error" ? "Error" : "Reply received"}</p>
            {result.result_status === "error"
              ? <p className="mt-1 text-sm text-amber-200">{result.error_code}: {result.error_message}</p>
              : <p className="mt-1 whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">{result.response_output}</p>}
            <p className="mt-3 text-xs text-slate-500">{result.latency_ms} ms · {formatDateTimeIST(result.started_at ?? result.created_at)}{result.result_status === "completed" ? ` · keyword score ${Number(result.total_score).toFixed(2)}` : ""}</p>
            {result.result_status === "completed" && result.failure_reason && <p className="mt-2 text-sm text-red-200">{result.failure_reason}</p>}
            {result.execution_source === "http_endpoint" && <Evidence result={result} />}
          </>}
        </article>;
      })}
    </section>
  </>;
}
