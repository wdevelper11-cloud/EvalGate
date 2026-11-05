import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { targetFields, type Target } from "@/lib/evalgate/targets";
import { createClient } from "@/lib/supabase/server";
import { ConnectionTest } from "./connection-test";

export const maxDuration = 60;

export default async function TargetsPage() {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  const { data, error } = await createClient().from("targets").select(targetFields).eq("project_id", workspace.project.id).order("created_at", { ascending: false });
  const targets = (data ?? []) as Target[];

  return <>
    <PageHeader eyebrow="Real agents" title="Targets" description="AI agent endpoints we are allowed to test. Keys are never stored here: each target names a server environment variable (TARGET_KEY_…) that holds its key." action={{ href: "/targets/new", label: "Add target" }} />
    {error ? <p role="alert" className="mt-7 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">Could not load targets. Confirm database patch 002 is applied.</p>
      : targets.length === 0 ? <section className="panel mt-7 p-10 text-center"><h2 className="font-semibold text-white">No targets yet</h2><p className="mt-2 text-sm text-slate-400">Add the endpoint you have permission to test.</p><Link href="/targets/new" className="button-primary mt-5">Add target</Link></section>
        : <section className="mt-7 grid gap-4 lg:grid-cols-2">{targets.map((target) => <article key={target.id} className="panel p-6">
          <h2 className="font-semibold text-white">{target.name}</h2>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{target.endpoint_url}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-slate-600">Format</dt><dd className="mt-1 text-slate-300">{target.request_format === "openai_chat" ? "OpenAI-compatible" : "Custom JSON"}{target.model ? ` · ${target.model}` : ""}</dd></div>
            <div><dt className="text-slate-600">Reply path</dt><dd className="mt-1 font-mono text-slate-300">{target.response_path || "choices.0.message.content"}</dd></div>
            <div><dt className="text-slate-600">Key</dt><dd className="mt-1 font-mono text-slate-300">{target.key_env_var ? `${target.auth_header_name}: ${target.auth_scheme ? `${target.auth_scheme} ` : ""}$${target.key_env_var}` : "No key"}</dd></div>
            <div><dt className="text-slate-600">Pacing</dt><dd className="mt-1 text-slate-300">{target.min_delay_ms / 1000}s apart · {target.timeout_ms / 1000}s timeout</dd></div>
          </dl>
          <ConnectionTest targetId={target.id} />
        </article>)}</section>}
  </>;
}
