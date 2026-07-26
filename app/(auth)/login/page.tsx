import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { login } from "../actions";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; message?: string } }) {
  return (
    <section className="panel p-7 sm:p-8">
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Log in to your workspace</h1>
      <p className="mt-2 text-sm text-slate-400">Review evaluation evidence and release readiness.</p>
      {searchParams.error && <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{searchParams.error}</p>}
      {searchParams.message && <p role="status" className="mt-5 rounded-lg border border-teal-400/30 bg-teal-400/10 p-3 text-sm text-teal-200">{searchParams.message}</p>}
      <form action={login} className="mt-7 space-y-5">
        <label className="label">Email address<input className="field" name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></label>
        <label className="label block">Password<input className="field" name="password" type="password" autoComplete="current-password" placeholder="••••••••" required /></label>
        <AuthSubmitButton idleLabel="Log in" pendingLabel="Logging in…" />
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">New to EvalGate? <Link className="font-medium text-teal-400 hover:text-teal-300" href="/signup">Create an account</Link></p>
    </section>
  );
}
