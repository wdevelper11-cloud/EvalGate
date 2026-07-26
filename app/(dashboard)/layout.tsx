import { AppShell } from "@/components/app-shell";
import { WorkspaceSetupError } from "@/components/workspace-setup-error";
import { redirect } from "next/navigation";
import { ensureDefaultProject } from "@/lib/evalgate/default-project";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const workspace = await ensureDefaultProject();

  if (!workspace.ok && workspace.reason === "unauthenticated") redirect("/login");
  if (!workspace.ok) {
    return <AppShell userEmail={workspace.email}><WorkspaceSetupError /></AppShell>;
  }

  return <AppShell userEmail={workspace.email} projectName={workspace.project.name}>{children}</AppShell>;
}
