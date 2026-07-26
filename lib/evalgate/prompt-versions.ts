export const promptVersionStatuses = ["draft", "active", "archived"] as const;

export type PromptVersionStatus = (typeof promptVersionStatuses)[number];

export type PromptVersion = {
  id: string;
  project_id: string;
  name: string;
  prompt_text: string;
  model_name: string;
  version_label: string;
  status: PromptVersionStatus;
  created_at: string;
  updated_at: string;
};

export type CreatePromptVersionInput = Pick<
  PromptVersion,
  "name" | "prompt_text" | "model_name" | "version_label" | "status"
>;

export function isPromptVersionStatus(value: string): value is PromptVersionStatus {
  return promptVersionStatuses.some((status) => status === value);
}
