import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import type { PromptVersion, PromptVersionStatus } from "@/lib/evalgate/prompt-versions";
import { createClient } from "@/lib/supabase/server";
import { activatePromptVersion, archivePromptVersion } from "./actions";

const fields = "id, project_id, name, prompt_text, model_name, version_label, status, created_at, updated_at";
const statusStyles: Record<PromptVersionStatus, string> = {
  draft: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  active: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  archived: "border-slate-600 bg-slate-800 text-slate-400",
};

export default async function PromptsPage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const supabase = createClient();
  const { data, error } = await supabase.from("prompt_versions").select(fields).eq("project_id", workspace.project.id).order("created_at", { ascending: false });
  const promptVersions = (data ?? []) as PromptVersion[];

  return <><PageHeader eyebrow="Registry" title="Prompt versions" description="Manage versioned instructions for simulated evaluation inside this workspace." action={{ href: "/prompts/new", label: "New prompt version" }} />{searchParams.error && <p role="alert" className="mt-6 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}{error ? <section role="alert" className="panel mt-7 border-red-400/30 p-6"><h2 className="font-semibold text-white">Could not load prompt versions</h2><p className="mt-2 text-sm text-slate-400">The prompt registry is temporarily unavailable. Refresh the page to try again.</p></section> : promptVersions.length === 0 ? <div className="mt-7"><EmptyState title="No prompt versions yet" description="Save the exact instructions and version label for the first candidate you want to test against your evaluation suite." href="/prompts/new" action="Create prompt version" /></div> : <section className="mt-7 grid gap-5 xl:grid-cols-2">{promptVersions.map((prompt) => <article key={prompt.id} className="panel p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-white">{prompt.name}</h2><span className="rounded bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">{prompt.version_label}</span></div><p className="mt-2 text-xs text-slate-600">Created {new Date(prompt.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}</p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[prompt.status]}`}>{prompt.status}</span></div><div className="mt-5 rounded-lg border border-slate-800 bg-slate-950/70 p-4"><p className="text-xs font-medium uppercase tracking-wider text-slate-600">Prompt preview</p><p className="mt-3 line-clamp-4 whitespace-pre-wrap font-mono text-xs leading-6 text-slate-400">{prompt.prompt_text}</p></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-slate-500">Model <span className="font-medium text-slate-300">{prompt.model_name}</span></p>{prompt.status !== "archived" && <div className="flex items-center gap-3">{prompt.status !== "active" && <form action={activatePromptVersion}><input type="hidden" name="id" value={prompt.id} /><button type="submit" className="text-xs font-semibold text-teal-400 hover:text-teal-300">Mark active</button></form>}<form action={archivePromptVersion}><input type="hidden" name="id" value={prompt.id} /><button type="submit" className="text-xs font-semibold text-slate-400 hover:text-white">Archive</button></form></div>}</div></article>)}</section>}<p className="mt-5 text-xs text-slate-600">Multiple prompt versions may be active; the current schema does not enforce a single active version.</p></>;
}
