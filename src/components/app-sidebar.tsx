"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, Clock, Copy, MoreHorizontal, Tags, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { revokeInvite } from "@/app/actions";
import { Brand } from "@/components/brand";
import { copyInvite, InviteDialog, WhatsAppIcon, whatsappUrl } from "@/components/invite-dialog";
import { RolesDialog } from "@/components/settings/roles-dialog";
import { TeacherActions } from "@/components/settings/teacher-actions";
import { UserMenu } from "@/components/user-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { initials, moneyShort } from "@/lib/format";
import type { TeacherListItem } from "@/lib/data";
import type { RoleDef } from "@/lib/types";

interface PendingInvite {
  id: string;
  token: string;
  name: string;
}

export function AppSidebar({
  team,
  user,
  teachers,
  invites,
  roles,
}: {
  team: string;
  user: { name: string; email: string };
  teachers: TeacherListItem[];
  invites: PendingInvite[];
  roles: RoleDef[];
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const missingRates = roles.filter((r) => r.rate === null).length;

  return (
    <Sidebar>
      <SidebarHeader className="px-3 pt-4">
        <Brand subtitle={team} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Profesores</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {teachers.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Aún no hay profesores.</p>
              )}
              {teachers.map((t) => {
                const href = `/t/${t.id}`;
                return (
                  <SidebarMenuItem key={t.id}>
                    <SidebarMenuButton
                      asChild
                      size="lg"
                      isActive={pathname === href}
                      onClick={() => setOpenMobile(false)}
                    >
                      <Link href={href} className="pr-8">
                        <Avatar className="size-8 rounded-lg">
                          <AvatarFallback className="rounded-lg bg-background text-xs font-medium">
                            {initials(t.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1 leading-tight">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate font-medium">{t.name}</span>
                            {t.awaitingBoss > 0 && (
                              <span
                                data-testid="awaiting-badge"
                                className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-amber-200 px-1 text-[10px] font-semibold text-amber-950"
                                title={`${t.awaitingBoss} pago(s) esperan tu confirmación`}
                              >
                                {t.awaitingBoss}
                              </span>
                            )}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {t.pendingAmount > 0 ? `${moneyShort(t.pendingAmount)} pendiente` : "Todo pagado"}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                    <TeacherActions
                      variant="sidebar"
                      teacherId={t.id}
                      name={t.name}
                      retention={t.retention}
                      roles={roles}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <RolesDialog
                  roles={roles}
                  trigger={
                    <SidebarMenuButton>
                      <Tags />
                      <span className="flex-1">Roles y tarifas</span>
                      {missingRates > 0 && (
                        <CircleAlert className="text-amber-600" aria-label="Faltan tarifas por definir" />
                      )}
                    </SidebarMenuButton>
                  }
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {invites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Invitaciones enviadas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {invites.map((i) => (
                  <SidebarMenuItem key={i.id}>
                    <SidebarMenuButton className="text-muted-foreground" tooltip="Esperando que cree su cuenta">
                      <Clock />
                      <span className="truncate">{i.name || "Invitación sin nombre"}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal />
                          <span className="sr-only">Opciones</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem asChild>
                          <a href={whatsappUrl({ token: i.token, name: i.name, team })} target="_blank" rel="noreferrer">
                            <WhatsAppIcon />
                            Reenviar por WhatsApp
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => copyInvite(i.token)}>
                          <Copy />
                          Copiar enlace
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={async () => {
                            const res = await revokeInvite(i.id);
                            if (res.ok) toast.success("Invitación cancelada");
                          }}
                        >
                          <Trash2 />
                          Cancelar invitación
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <InviteDialog
          team={team}
          trigger={
            <Button className="w-full">
              <UserPlus />
              Invitar profesor/a
            </Button>
          }
        />
        <UserMenu name={user.name} email={user.email} />
      </SidebarFooter>
    </Sidebar>
  );
}
