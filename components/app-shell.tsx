import Link from "next/link";

const navigation = [
  ["Overview", "/dashboard"], ["Test cases", "/test-cases"], ["Prompts", "/prompts"],
  ["Evaluations", "/evaluations"], ["Results", "/results"], ["Reports", "/reports"], ["Audit", "/audit"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 lg:fixed lg:inset-y-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-400 text-xs text-slate-950">EG</span>EvalGate</Link>
          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300">Skeleton</span>
        </div>
        <nav aria-label="Application navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:pb-0">
          {navigation.map(([label, href]) => <Link key={href} href={href} className="block shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-900 hover:text-white">{label}</Link>)}
        </nav>
        <div className="hidden px-5 lg:absolute lg:bottom-6 lg:block"><p className="text-xs leading-5 text-slate-600">Phase 2 interface<br />No backend connected</p></div>
      </aside>
      <div className="lg:col-start-2">
        <header className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/60 px-5 lg:px-8"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">Release readiness workspace</p><span className="h-8 w-8 rounded-full border border-slate-700 bg-slate-800" aria-label="Account placeholder" /></header>
        <main className="mx-auto max-w-7xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
