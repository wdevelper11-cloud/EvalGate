import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { TestCase } from "@/lib/evalgate/test-cases";
import { createClient } from "@/lib/supabase/server";
import { archiveTestCase } from "./actions";

const fields = "id, project_id, name, input, expected_keywords, forbidden_keywords, category, priority, status, created_at, updated_at";
const badgeStyles = {
  category: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  archived: "border-slate-600 bg-slate-800 text-slate-400",
  low: "border-slate-600 bg-slate-800 text-slate-300",
  medium: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  high: "border-orange-400/20 bg-orange-400/10 text-orange-300",
  critical: "border-red-400/20 bg-red-400/10 text-red-300",
} as const;

function Badge({ label, style }: { label: string; style: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>{label}</span>;
}

function Keywords({ label, values, forbidden = false }: { label: string; values: string[]; forbidden?: boolean }) {
  return <div><p className="text-xs font-medium uppercase tracking-wider text-slate-600">{label}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.length ? values.map((value) => <span key={value} className={`rounded px-2 py-1 text-xs ${forbidden ? "bg-red-400/10 text-red-300" : "bg-teal-400/10 text-teal-300"}`}>{value}</span>) : <span className="text-xs text-slate-600">None configured</span>}</div></div>;
}

export default async function TestCasesPage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const supabase = createClient();
  const { data, error } = await supabase.from("test_cases").select(fields).eq("project_id", workspace.project.id).order("created_at", { ascending: false });
  const testCases = (data ?? []) as TestCase[];

  return <><PageHeader eyebrow="Registry" title="Test cases" description="Manage repeatable quality, safety, format, latency, and cost scenarios for this workspace." action={{ href: "/test-cases/new", label: "New test case" }} />{searchParams.error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}{error ? <section role="alert" className="panel mt-7 border-red-400/30 p-6"><h2 className="font-semibold text-white">Could not load test cases</h2><p className="mt-2 text-sm text-slate-400">The registry is temporarily unavailable. Refresh the page to try again.</p></section> : testCases.length === 0 ? <div className="mt-7"><EmptyState title="No test cases yet" description="Create the first scenario to start building repeatable evaluation coverage." href="/test-cases/new" action="Create test case" /></div> : <section className="mt-7 grid gap-5 xl:grid-cols-2">{testCases.map((testCase) => <article key={testCase.id} className="panel p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold text-white">{testCase.name}</h2><p className="mt-1 text-xs text-slate-600">Created {new Date(testCase.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}</p></div><div className="flex flex-wrap gap-2"><Badge label={testCase.category} style={badgeStyles.category} /><Badge label={testCase.priority} style={badgeStyles[testCase.priority]} /><Badge label={testCase.status} style={badgeStyles[testCase.status]} /></div></div><p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-400">{testCase.input}</p><div className="mt-5 grid gap-4 border-t border-slate-800 pt-5 sm:grid-cols-2"><Keywords label="Expected keywords" values={testCase.expected_keywords} /><Keywords label="Forbidden keywords" values={testCase.forbidden_keywords} forbidden /></div>{testCase.status === "active" && <form action={archiveTestCase} className="mt-5 border-t border-slate-800 pt-4"><input type="hidden" name="id" value={testCase.id} /><button type="submit" className="text-xs font-semibold text-slate-400 hover:text-white">Archive test case</button></form>}</article>)}</section>}</>;
}
