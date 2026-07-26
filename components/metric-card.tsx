export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="panel p-5"><p className="text-sm font-medium text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>;
}
