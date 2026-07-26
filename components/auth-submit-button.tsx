"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="button-primary w-full disabled:cursor-wait disabled:opacity-60">
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
