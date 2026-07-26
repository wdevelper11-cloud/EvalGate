export function WorkspaceSetupError() {
  return (
    <section role="alert" className="panel border-red-400/30 p-6">
      <p className="eyebrow text-red-300">Setup required</p>
      <h1 className="mt-2 text-xl font-semibold text-white">Workspace setup failed</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        EvalGate could not prepare your profile and default project. Refresh to try again, then
        confirm the Supabase schema and environment configuration if the problem continues.
      </p>
    </section>
  );
}
