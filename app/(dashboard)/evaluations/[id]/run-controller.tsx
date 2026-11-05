"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { runNextCase } from "./actions";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Drives a running HTTP run one case per server call. The server enforces pacing. */
export function RunController({ runId, initiallyRunning }: { runId: string; initiallyRunning: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const loop = useCallback(async () => {
    stopRef.current = false;
    setActive(true);
    setError(null);
    try {
      while (!stopRef.current) {
        const step = await runNextCase(runId);
        if (step.kind === "wait") {
          setMessage(`Waiting ${Math.ceil(step.ms / 1000)} s before the next question…`);
          await sleep(step.ms + 100);
        } else if (step.kind === "case") {
          setMessage(`${step.done} of ${step.total} sent · “${step.testCaseName}” ${step.status === "completed" ? "answered" : "errored"}`);
          router.refresh();
        } else if (step.kind === "finished") {
          setMessage(`Run ${step.status}.`);
          router.refresh();
          break;
        } else {
          setError(step.message);
          break;
        }
      }
    } catch {
      setError("Lost contact with the server. Press Resume to continue from the next unsent case.");
    } finally {
      setActive(false);
    }
  }, [router, runId]);

  useEffect(() => () => { stopRef.current = true; }, []);

  if (!initiallyRunning && !active) return null;

  return (
    <div className="panel mt-6 flex flex-wrap items-center gap-4 p-5">
      {active
        ? <button type="button" className="button-secondary" onClick={() => { stopRef.current = true; setMessage("Pausing after the current question…"); }}>Pause</button>
        : <button type="button" className="button-primary" onClick={loop}>{message ? "Resume run" : "Start sending questions"}</button>}
      <p className="text-sm text-slate-400" role="status">{message ?? "Questions are sent one at a time, spaced out. Keep this tab open while it runs; you can resume later."}</p>
      {error && <p role="alert" className="w-full text-sm text-red-300">{error}</p>}
    </div>
  );
}
