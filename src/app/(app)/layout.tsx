import { Brand } from "@/components/brand";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { UserMenu } from "@/components/user-menu";
import { getPricing } from "@/lib/data";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const pricing = await getPricing(user.id);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Brand subtitle={user.name} />
          <div className="flex items-center gap-1">
            <SettingsDialog pricing={pricing} />
            <UserMenu name={user.name} email={user.email} compact />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
