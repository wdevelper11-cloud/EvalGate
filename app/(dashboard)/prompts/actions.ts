"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import {
  isPromptVersionStatus,
  type CreatePromptVersionInput,
  type PromptVersionStatus,
} from "@/lib/evalgate/prompt-versions";
import { createClient } from "@/lib/supabase/server";

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createPromptVersion(formData: FormData) {
  const name = formText(formData, "name");
  const promptText = formText(formData, "prompt_text");
  const modelName = formText(formData, "model_name");
  const versionLabel = formText(formData, "version_label");
  const status = formText(formData, "status");

  if (!name || !promptText || !modelName || !versionLabel) {
    redirectWithError("/prompts/new", "Name, version label, model name, and prompt text are required.");
  }
  if (!isPromptVersionStatus(status)) {
    redirectWithError("/prompts/new", "Choose a valid prompt status.");
  }

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("/prompts/new", "Workspace setup is unavailable. Please try again.");

  const promptVersion: CreatePromptVersionInput & { project_id: string } = {
    project_id: workspace.project.id,
    name,
    prompt_text: promptText,
    model_name: modelName,
    version_label: versionLabel,
    status,
  };

  const supabase = createClient();
  const { error } = await supabase.from("prompt_versions").insert(promptVersion);
  if (error) redirectWithError("/prompts/new", "Could not create the prompt version. Please try again.");

  revalidatePath("/prompts");
  redirect("/prompts");
}

async function setPromptVersionStatus(formData: FormData, status: PromptVersionStatus) {
  const id = formText(formData, "id");
  if (!id) redirectWithError("/prompts", "The selected prompt version is invalid.");

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("/prompts", "Workspace setup is unavailable. Please try again.");

  const supabase = createClient();
  const { error } = await supabase
    .from("prompt_versions")
    .update({ status })
    .eq("id", id)
    .eq("project_id", workspace.project.id);

  if (error) redirectWithError("/prompts", `Could not mark the prompt version as ${status}. Please try again.`);
  revalidatePath("/prompts");
}

export async function activatePromptVersion(formData: FormData) {
  await setPromptVersionStatus(formData, "active");
}

export async function archivePromptVersion(formData: FormData) {
  await setPromptVersionStatus(formData, "archived");
}
