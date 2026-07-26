const styles: Record<string, string> = {
  ship: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  needs_review: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  block: "border-red-400/30 bg-red-400/10 text-red-300",
};

export function ReleaseDecisionBadge({ decision = "Awaiting run" }: { decision?: string }) {
  const style = styles[decision] ?? "border-slate-600 bg-slate-800 text-slate-400";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${style}`}>{decision.replace("_", " ")}</span>;
}
