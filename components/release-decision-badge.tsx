export function ReleaseDecisionBadge({ decision = "Awaiting run" }: { decision?: string }) {
  return <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300">{decision}</span>;
}
