import Link from "next/link";

export function EmptyState({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return <div className="panel grid min-h-64 place-items-center p-8 text-center"><div><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-dashed border-slate-600 text-xl text-teal-400">+</span><h2 className="mt-4 font-semibold text-white">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p><Link href={href} className="button-secondary mt-5">{action}</Link></div></div>;
}
