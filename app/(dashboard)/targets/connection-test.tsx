"use client";

import { useFormState, useFormStatus } from "react-dom";
import { testTargetConnection, type ConnectionCheck } from "./actions";

function TestButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button-secondary disabled:cursor-wait disabled:opacity-60">{pending ? "Sending “Hello”…" : "Test connection"}</button>;
}

export function ConnectionTest({ targetId }: { targetId: string }) {
  const [state, action] = useFormState<ConnectionCheck, FormData>(testTargetConnection, null);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="target_id" value={targetId} />
      <TestButton />
      {state && state.targetId === targetId && (
        <div role="status" className={`mt-3 rounded-lg border p-3 text-sm ${state.ok ? "border-teal-400/30 bg-teal-400/10 text-teal-100" : "border-red-400/30 bg-red-400/10 text-red-100"}`}>
          <p className="font-medium">{state.summary}</p>
          {state.detail && <p className="mt-1 whitespace-pre-wrap break-words text-xs opacity-80">{state.detail}</p>}
        </div>
      )}
    </form>
  );
}
