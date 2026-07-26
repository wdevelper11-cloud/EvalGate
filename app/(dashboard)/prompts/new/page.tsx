import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { promptVersionStatuses } from "@/lib/evalgate/prompt-versions";
import { createPromptVersion } from "../actions";

export default async function NewPromptPage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  return <><PageHeader eyebrow="Prompt registry" title="Create prompt version" description={`Record an exact prompt candidate for ${workspace.project.name}.`} />{searchParams.error && <p role="alert" className="mt-6 max-w-4xl rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}<form action={createPromptVersion} className="panel mt-7 max-w-4xl p-6 sm:p-8"><div className="grid gap-6 sm:grid-cols-2"><label className="label">Name<input name="name" className="field" placeholder="Support Agent Base Prompt" required /></label><label className="label">Version label<input name="version_label" className="field" placeholder="v1.0" required /></label><label className="label sm:col-span-2">Prompt text<textarea name="prompt_text" className="field min-h-48 resize-y font-mono" placeholder="You are a helpful support agent..." required /></label><label className="label">Model name<input name="model_name" className="field" defaultValue="simulated-model" required /></label><label className="label">Status<select name="status" className="field" defaultValue="draft">{promptVersionStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><p className="mt-6 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs leading-5 text-slate-500">The MVP records model context only. It does not call a real AI provider.</p><div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6"><div className="w-full sm:w-auto"><AuthSubmitButton idleLabel="Save prompt version" pendingLabel="Saving prompt version…" /></div><Link href="/prompts" className="button-secondary">Cancel</Link></div></form></>;
}
