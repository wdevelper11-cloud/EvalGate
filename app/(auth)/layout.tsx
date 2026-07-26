import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#134e4a_0%,#070b14_40%)] p-5"><div className="w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center gap-2 font-bold text-white"><span className="grid h-9 w-9 place-items-center rounded-lg bg-teal-400 text-xs text-slate-950">EG</span>EvalGate</Link>{children}</div></main>; }
