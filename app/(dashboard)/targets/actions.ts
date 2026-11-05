"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runHttpCase } from "@/lib/evalgate/adapters/http-endpoint";
import { httpsTransport } from "@/lib/evalgate/adapters/transport";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { isOperator } from "@/lib/evalgate/operator";
import { parseTargetForm, targetFields, targetToConfig, type Target, type TargetFormValues } from "@/lib/evalgate/targets";
import { createClient } from "@/lib/supabase/server";

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWithError(message: string): never {
  redirect(`/targets/new?error=${encodeURIComponent(message)}`);
}

export async function createTarget(formData: FormData) {
  if (!(await isOperator())) redirectWithError("Only operator accounts can create targets.");

  const keys: Array<keyof TargetFormValues> = [
    "name", "endpoint_url", "request_format", "model", "request_template", "response_path",
    "auth_header_name", "auth_scheme", "key_env_var", "min_delay_seconds", "timeout_seconds",
  ];
  const form = Object.fromEntries(keys.map((key) => [key, formText(formData, key)])) as TargetFormValues;
  const parsed = parseTargetForm(form);
  if (!parsed.ok) redirectWithError(parsed.error);

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("Workspace setup is unavailable. Please try again.");

  const { error } = await createClient().from("targets").insert({ ...parsed.value, project_id: workspace.project.id });
  if (error) redirectWithError("Could not save the target. Confirm database patch 002 is applied.");

  revalidatePath("/targets");
  redirect("/targets");
}

export type ConnectionCheck = {
  targetId: string;
  ok: boolean;
  summary: string;
  detail: string | null;
  checkedAt: string;
} | null;

/** Sends one harmless "Hello" to check format, key and response path. Nothing is stored. */
export async function testTargetConnection(_previous: ConnectionCheck, formData: FormData): Promise<ConnectionCheck> {
  const targetId = formText(formData, "target_id");
  const checkedAt = new Date().toISOString();
  if (!(await isOperator())) return { targetId, ok: false, summary: "Only operator accounts can test targets.", detail: null, checkedAt };

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) return { targetId, ok: false, summary: "Workspace setup is unavailable.", detail: null, checkedAt };

  const { data, error } = await createClient().from("targets").select(targetFields).eq("id", targetId).eq("project_id", workspace.project.id).maybeSingle();
  if (error || !data) return { targetId, ok: false, summary: "Target not found.", detail: null, checkedAt };
  const target = data as Target;

  const record = await runHttpCase(targetToConfig(target), "Hello", {
    transport: httpsTransport,
    env: process.env,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: Date.now,
  });

  if (record.status === "completed") {
    return {
      targetId,
      ok: true,
      summary: `Connected · HTTP ${record.responseStatus} · ${record.latencyMs} ms`,
      detail: `Reply: ${record.output.slice(0, 300)}`,
      checkedAt,
    };
  }
  return {
    targetId,
    ok: false,
    summary: `${record.errorCode}: ${record.errorMessage}`,
    detail: record.responseRaw ? `Raw response: ${record.responseRaw.slice(0, 300)}` : null,
    checkedAt,
  };
}
