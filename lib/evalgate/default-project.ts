import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
};

export type DefaultProject = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type WorkspaceSuccess = {
  ok: true;
  email: string;
  profile: Profile;
  project: DefaultProject;
};

type WorkspaceFailure = {
  ok: false;
  reason: "unauthenticated" | "setup_failed";
  email?: string;
};

export type WorkspaceResult = WorkspaceSuccess | WorkspaceFailure;

const profileFields = "id, email, full_name, created_at, updated_at";
const projectFields = "id, owner_id, name, description, created_at, updated_at";
const defaultDescription = "Default workspace for evaluating AI agents and prompt releases.";

export const ensureDefaultProject = cache(async (): Promise<WorkspaceResult> => {
  try {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.email) return { ok: false, reason: "unauthenticated" };

    const rawFullName: unknown = user.user_metadata?.full_name;
    const fullName = typeof rawFullName === "string" && rawFullName.trim()
      ? rawFullName.trim()
      : null;

    const { data: existingProfile, error: profileReadError } = await supabase
      .from("profiles")
      .select(profileFields)
      .eq("id", user.id)
      .maybeSingle();

    if (profileReadError) return { ok: false, reason: "setup_failed", email: user.email };

    let profile = existingProfile as Profile | null;
    if (!profile) {
      const { data: createdProfile, error: profileCreateError } = await supabase
        .from("profiles")
        .insert({ id: user.id, email: user.email, full_name: fullName })
        .select(profileFields)
        .single();

      if (profileCreateError || !createdProfile) {
        return { ok: false, reason: "setup_failed", email: user.email };
      }
      profile = createdProfile as Profile;
    } else if (profile.email !== user.email) {
      const { data: updatedProfile, error: profileUpdateError } = await supabase
        .from("profiles")
        .update({ email: user.email })
        .eq("id", user.id)
        .select(profileFields)
        .single();

      if (profileUpdateError || !updatedProfile) {
        return { ok: false, reason: "setup_failed", email: user.email };
      }
      profile = updatedProfile as Profile;
    }

    const { data: existingProject, error: projectReadError } = await supabase
      .from("projects")
      .select(projectFields)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (projectReadError) return { ok: false, reason: "setup_failed", email: user.email };

    let project = existingProject as DefaultProject | null;
    if (!project) {
      const { data: createdProject, error: projectCreateError } = await supabase
        .from("projects")
        .insert({
          owner_id: user.id,
          name: "Default EvalGate Project",
          description: defaultDescription,
        })
        .select(projectFields)
        .single();

      if (projectCreateError || !createdProject) {
        return { ok: false, reason: "setup_failed", email: user.email };
      }
      project = createdProject as DefaultProject;
    }

    return { ok: true, email: user.email, profile, project };
  } catch {
    return { ok: false, reason: "setup_failed" };
  }
});
