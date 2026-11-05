export function NoAccess() {
  return (
    <section role="alert" className="panel border-amber-400/30 p-6">
      <p className="eyebrow text-amber-300">Access not enabled</p>
      <h1 className="mt-2 text-xl font-semibold text-white">This account cannot use the workspace</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        Only operator accounts can open the workspace. If this is your account, add it to the
        operators table from the Supabase SQL editor, then refresh.
      </p>
    </section>
  );
}
