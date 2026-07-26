"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import {
  isTestCaseCategory,
  isTestCasePriority,
  isTestCaseStatus,
  parseKeywordList,
  type CreateTestCaseInput,
} from "@/lib/evalgate/test-cases";
import { createClient } from "@/lib/supabase/server";

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function createTestCase(formData: FormData) {
  const name = formText(formData, "name");
  const input = formText(formData, "input");
  const category = formText(formData, "category");
  const priority = formText(formData, "priority");
  const status = formText(formData, "status");

  if (!name || !input) redirectWithError("/test-cases/new", "Name and input are required.");
  if (!isTestCaseCategory(category)) redirectWithError("/test-cases/new", "Choose a valid category.");
  if (!isTestCasePriority(priority)) redirectWithError("/test-cases/new", "Choose a valid priority.");
  if (!isTestCaseStatus(status)) redirectWithError("/test-cases/new", "Choose a valid status.");

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("/test-cases/new", "Workspace setup is unavailable. Please try again.");

  const testCase: CreateTestCaseInput & { project_id: string } = {
    project_id: workspace.project.id,
    name,
    input,
    expected_keywords: parseKeywordList(formText(formData, "expected_keywords")),
    forbidden_keywords: parseKeywordList(formText(formData, "forbidden_keywords")),
    category,
    priority,
    status,
  };

  const supabase = createClient();
  const { error } = await supabase.from("test_cases").insert(testCase);
  if (error) redirectWithError("/test-cases/new", "Could not create the test case. Please try again.");

  revalidatePath("/test-cases");
  redirect("/test-cases");
}

export async function archiveTestCase(formData: FormData) {
  const id = formText(formData, "id");
  if (!id) redirectWithError("/test-cases", "The selected test case is invalid.");

  const workspace = await ensureDefaultProject();
  if (!workspace.ok) redirectWithError("/test-cases", "Workspace setup is unavailable. Please try again.");

  const supabase = createClient();
  const { error } = await supabase
    .from("test_cases")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("project_id", workspace.project.id);

  if (error) redirectWithError("/test-cases", "Could not archive the test case. Please try again.");

  revalidatePath("/test-cases");
}
