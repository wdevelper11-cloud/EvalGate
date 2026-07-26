"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  ["Overview", "/dashboard"],
  ["Test cases", "/test-cases"],
  ["Prompt versions", "/prompts"],
  ["Evaluations", "/evaluations"],
  ["Results", "/results"],
  ["Reports", "/reports"],
  ["Audit", "/audit"],
] as const;

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Evaluation workflow" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:pb-0">
      {navigation.map(([label, href], index) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-teal-400/10 text-teal-200" : "text-slate-400 hover:bg-slate-900 hover:text-white"}`}
          >
            <span className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${active ? "bg-teal-400 text-slate-950" : "bg-slate-900 text-slate-600 group-hover:text-slate-300"}`}>{index + 1}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
