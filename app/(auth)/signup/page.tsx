import Link from "next/link";
import { AuthSubmitButton } from "@/components/auth-submit-button";
import { signup } from "../actions";

export default function SignupPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <section className="panel p-7 sm:p-8">
      <p className="eyebrow">Create account</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Start evaluating with confidence</h1>
      <p className="mt-2 text-sm text-slate-400">Sign up with email and password to access EvalGate.</p>
      {searchParams.error && <p role="alert" className="mt-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{searchParams.error}</p>}
      <form action={signup} className="mt-7 space-y-5">
        <label className="label">Email address<input className="field" name="email" type="email" autoComplete="email" placeholder="you@company.com" required /></label>
        <label className="label block">Password<input className="field" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength={8} required /></label>
        <AuthSubmitButton idleLabel="Create account" pendingLabel="Creating account…" />
      </form>
      <p className="mt-4 text-xs leading-5 text-slate-500">If email confirmation is enabled, we will ask you to confirm your address before logging in.</p>
      <p className="mt-6 text-center text-sm text-slate-400">Already have an account? <Link className="font-medium text-teal-400 hover:text-teal-300" href="/login">Log in</Link></p>
    </section>
  );
}
