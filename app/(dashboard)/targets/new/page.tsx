import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { PageHeader } from "@/components/page-header";
import { createTarget } from "../actions";

const templateExample = `{
  "message": "{{input}}",
  "session_id": "preshock-test"
}`;

export default function NewTargetPage({ searchParams }: { searchParams: { error?: string } }) {
  return <>
    <PageHeader eyebrow="Real agents" title="Add target" description="Only add endpoints you have written permission to test. Questions are sent one at a time, spaced out like a normal user." />
    {searchParams.error && <p role="alert" className="mt-6 max-w-4xl rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}
    <form action={createTarget} className="panel mt-7 max-w-4xl p-6 sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="label sm:col-span-2">Name<input name="name" className="field" placeholder="Acme support bot (staging)" required maxLength={120} /></label>
        <label className="label sm:col-span-2">Endpoint URL<input name="endpoint_url" type="url" className="field font-mono" placeholder="https://api.example.com/v1/chat/completions" required /><span className="mt-1.5 block text-xs font-normal text-slate-600">https only. Private, local and internal addresses are refused, and redirects are never followed.</span></label>
        <label className="label">Request format<select name="request_format" className="field" defaultValue="openai_chat"><option value="openai_chat">OpenAI-compatible chat</option><option value="custom_json">Custom JSON</option></select></label>
        <label className="label">Model <span className="font-normal text-slate-600">(OpenAI format, optional)</span><input name="model" className="field font-mono" placeholder="gpt-4o-mini" /></label>
        <label className="label sm:col-span-2">Request template <span className="font-normal text-slate-600">(custom JSON only)</span><textarea name="request_template" className="field min-h-28 resize-y font-mono" placeholder={templateExample} /><span className="mt-1.5 block text-xs font-normal text-slate-600">Valid JSON. Every {"{{input}}"} inside a string is replaced with the question, safely escaped.</span></label>
        <label className="label sm:col-span-2">Response path<input name="response_path" className="field font-mono" placeholder="choices.0.message.content" /><span className="mt-1.5 block text-xs font-normal text-slate-600">Dot path to the reply text. Required for custom JSON; defaults to choices.0.message.content for OpenAI format.</span></label>
        <label className="label">Key environment variable<input name="key_env_var" className="field font-mono" placeholder="TARGET_KEY_ACME" pattern="TARGET_KEY_[A-Z0-9_]{1,64}" /><span className="mt-1.5 block text-xs font-normal text-slate-600">Set the real key in Vercel env vars under this name. Leave empty if no key.</span></label>
        <div className="grid grid-cols-2 gap-4">
          <label className="label">Auth header<input name="auth_header_name" className="field font-mono" placeholder="Authorization" /></label>
          <label className="label">Scheme<input name="auth_scheme" className="field font-mono" defaultValue="Bearer" /></label>
        </div>
        <label className="label">Seconds between questions<input name="min_delay_seconds" type="number" min={2} max={60} step={1} defaultValue={5} className="field" /></label>
        <label className="label">Timeout (seconds)<input name="timeout_seconds" type="number" min={1} max={15} step={1} defaultValue={15} className="field" /></label>
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6"><div className="w-full sm:w-auto"><AuthSubmitButton idleLabel="Save target" pendingLabel="Saving target…" /></div><Link href="/targets" className="button-secondary">Cancel</Link></div>
    </form>
  </>;
}
