import Link from "next/link";
import { AppNavigation } from "@/components/app-navigation";
import { LogoutButton } from "@/components/logout-button";

export function AppShell({ children, userEmail, projectName }: { children: React.ReactNode; userEmail?: string; projectName?: string }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950 lg:fixed lg:inset-y-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-400 text-xs text-slate-950">EG</span>EvalGate</Link>
          <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-300">Cloud auth</span>
        </div>
        <AppNavigation />
        <div className="hidden px-5 lg:absolute lg:bottom-6 lg:block"><p className="max-w-48 truncate text-xs font-medium text-slate-400">{projectName ?? "Workspace unavailable"}</p><p className="mt-1 text-xs text-slate-600">Supabase Cloud workspace</p></div>
      </aside>
      <div className="lg:col-start-2">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/60 px-5 py-3 lg:px-8"><p className="text-xs font-medium uppercase tracking-widest text-slate-500">Release readiness workspace</p><div className="flex min-w-0 items-center gap-3"><span className="hidden max-w-52 truncate text-xs text-slate-500 sm:block">{userEmail}</span><LogoutButton /></div></header>
        <main className="mx-auto max-w-7xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
