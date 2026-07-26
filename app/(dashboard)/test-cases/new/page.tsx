import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { PageHeader } from "@/components/page-header";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { testCaseCategories, testCasePriorities, testCaseStatuses } from "@/lib/evalgate/test-cases";
import { createTestCase } from "../actions";

export default async function NewTestCasePage({ searchParams }: { searchParams: { error?: string } }) {
  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return <WorkspaceSetupError />;

  return <><PageHeader eyebrow="Test registry" title="Create test case" description={`Add a reusable scenario to ${workspace.project.name}.`} />{searchParams.error && <p role="alert" className="mt-6 max-w-4xl rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{searchParams.error}</p>}<form action={createTestCase} className="panel mt-7 max-w-4xl p-6 sm:p-8"><div className="grid gap-6 sm:grid-cols-2"><label className="label sm:col-span-2">Name<input name="name" className="field" placeholder="Support refund policy answer" required /></label><label className="label sm:col-span-2">Input<textarea name="input" className="field min-h-28 resize-y" placeholder="A customer asks whether they can get a refund after 30 days." required /></label><label className="label">Expected keywords<input name="expected_keywords" className="field" placeholder="refund, policy, support" /><span className="mt-1.5 block text-xs font-normal text-slate-600">Comma-separated required terms</span></label><label className="label">Forbidden keywords<input name="forbidden_keywords" className="field" placeholder="guaranteed, ignore policy" /><span className="mt-1.5 block text-xs font-normal text-slate-600">Comma-separated safety terms</span></label><label className="label">Category<select name="category" className="field" defaultValue="quality">{testCaseCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="label">Priority<select name="priority" className="field" defaultValue="medium">{testCasePriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label className="label">Status<select name="status" className="field" defaultValue="active">{testCaseStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-6"><div className="w-full sm:w-auto"><AuthSubmitButton idleLabel="Save test case" pendingLabel="Saving test case…" /></div><Link href="/test-cases" className="button-secondary">Cancel</Link></div></form></>;
}
