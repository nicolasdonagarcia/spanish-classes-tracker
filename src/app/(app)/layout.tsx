import { AppSidebar } from "@/components/app-sidebar";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getPendingInvites, getTeachers } from "@/lib/data";
import { teamRoles } from "@/lib/roles";
import { requireMember } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const v = await requireMember();

  if (v.member.role === "teacher") {
    return (
      <div className="flex min-h-svh flex-col">
        <header className="border-b bg-background">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
            <Brand subtitle={v.team.name} />
            <UserMenu name={v.user.name} email={v.user.email} compact />
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  const [teachers, invites] = await Promise.all([
    getTeachers(v.team._id),
    getPendingInvites(v.team._id),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar
        team={v.team.name}
        user={{ name: v.user.name, email: v.user.email }}
        teachers={teachers}
        invites={invites}
        roles={teamRoles(v.team.roles)}
      />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
