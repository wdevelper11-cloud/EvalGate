import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-400 text-sm text-slate-950">EG</span>
          EvalGate
        </Link>
        <nav aria-label="Public navigation" className="flex items-center gap-2">
          <Link href="/login" className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white">Log in</Link>
          <Link href="/signup" className="button-primary">Start evaluating</Link>
        </nav>
      </div>
    </header>
  );
}
