import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { NoAccess } from "@/components/no-access";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";
import { isOperator } from "@/lib/evalgate/operator";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isOperator())) {
    const { data: { user } } = await createClient().auth.getUser();
    if (!user) redirect("/login");
    return <AppShell userEmail={user.email}><NoAccess /></AppShell>;
  }

  const workspace = await ensureDefaultProject();
  if (!workspace.ok && workspace.reason === "unauthenticated") redirect("/login");
  if (!workspace.ok) {
    return <AppShell userEmail={workspace.email}><WorkspaceSetupError /></AppShell>;
  }

  return <AppShell userEmail={workspace.email} projectName={workspace.project.name}>{children}</AppShell>;
}
