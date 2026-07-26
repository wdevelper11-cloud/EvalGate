"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/app/(dashboard)/actions";

function LogoutSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="text-xs font-medium text-slate-400 hover:text-white disabled:opacity-50">{pending ? "Signing out…" : "Log out"}</button>;
}

export function LogoutButton() {
  return <form action={logout}><LogoutSubmitButton /></form>;
}
