import Link from "next/link";
import { Navbar } from "@/components/navbar";

const features = [
  ["Reusable test registry", "Capture quality, safety, format, latency, and cost scenarios once, then reuse them across prompt releases."],
  ["Version-aware evaluation", "Keep every prompt candidate distinct so teams always know which configuration produced an outcome."],
  ["Explainable release gates", "Turn test evidence into a clear Ship, Needs Review, or Block recommendation—not another opaque score."],
];

export default function Home() {
  return <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-20%,#134e4a_0%,#070b14_45%)]"><Navbar />
    <main>
      <section className="mx-auto max-w-7xl px-5 py-24 text-center sm:py-32 lg:px-8">
        <p className="eyebrow">AI release confidence, made concrete</p>
        <h1 className="mx-auto mt-5 max-w-4xl text-5xl font-bold tracking-[-0.04em] text-white sm:text-7xl">Stop guessing whether your agent is ready to ship.</h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-slate-400">EvalGate helps teams test prompt and agent changes against repeatable quality, safety, format, latency, and cost checks before release.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3"><Link href="/signup" className="button-primary">Create workspace</Link><Link href="/dashboard" className="button-secondary">Open workspace <span className="ml-2">→</span></Link></div>
        <div className="mt-16 grid overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 text-left sm:grid-cols-2">
          <div className="p-7 sm:p-10"><p className="eyebrow">The problem</p><h2 className="mt-3 text-xl font-semibold text-white">Manual prompt checks do not make release evidence.</h2><p className="mt-3 text-sm leading-6 text-slate-400">Scattered testing misses regressions, hides safety risks, and makes every go/no-go decision feel subjective.</p></div>
          <div className="border-t border-slate-800 bg-teal-400/[0.04] p-7 sm:border-l sm:border-t-0 sm:p-10"><p className="eyebrow">The solution</p><h2 className="mt-3 text-xl font-semibold text-white">A repeatable gate between a change and production.</h2><p className="mt-3 text-sm leading-6 text-slate-400">Save scenarios, compare prompt versions, inspect deterministic evidence, and communicate a release decision the whole team understands.</p></div>
        </div>
      </section>
      <section className="border-y border-slate-800 bg-slate-950/50"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><p className="eyebrow">Built for engineering teams</p><h2 className="mt-3 text-3xl font-bold text-white">One focused workflow from scenario to decision.</h2><div className="mt-10 grid gap-5 md:grid-cols-3">{features.map(([title, body], index) => <article key={title} className="panel p-6"><span className="font-mono text-sm text-teal-400">0{index + 1}</span><h3 className="mt-8 font-semibold text-white">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-400">{body}</p></article>)}</div></div></section>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center"><h2 className="text-3xl font-bold text-white">Make the next release decision defensible.</h2><p className="mt-4 text-slate-400">Set up your evaluation workspace and turn repeatable test evidence into a clear release decision.</p><div className="mt-7 flex justify-center gap-3"><Link href="/login" className="button-secondary">Log in</Link><Link href="/signup" className="button-primary">Get started</Link></div></section>
    </main><footer className="border-t border-slate-800 px-5 py-8 text-center text-xs text-slate-600">EvalGate · AI Agent Evaluation &amp; Release Readiness Harness</footer></div>;
}
