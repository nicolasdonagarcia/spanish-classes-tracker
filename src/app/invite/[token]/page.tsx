import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { JoinButton } from "@/components/team-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInviteInfo } from "@/lib/data";
import { getViewer } from "@/lib/session";

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const [info, v] = await Promise.all([getInviteInfo(token), getViewer()]);

  if (!info || !info.valid) {
    return (
      <AuthShell>
        <Card>
          <CardHeader>
            <CircleAlert className="mb-2 size-6 text-amber-600" />
            <CardTitle className="text-xl">Este enlace ya no funciona</CardTitle>
            <CardDescription>
              Ya fue usado o expiró. Pide a tu jefe/a que te envíe un enlace nuevo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Ir al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  const greeting = info.name ? `¡Hola, ${info.name}!` : "¡Hola!";

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{greeting}</CardTitle>
          <CardDescription>
            <span className="font-medium text-foreground">{info.bossName}</span> te invitó a registrar
            tus clases en <span className="font-medium text-foreground">{info.teamName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!v ? (
            <AuthForm mode="signup" inviteToken={token} />
          ) : v.member ? (
            <div className="grid gap-3 text-sm">
              <p className="text-muted-foreground">
                Ya perteneces a un equipo ({v.team?.name}). Cada cuenta puede estar en un solo equipo.
              </p>
              <Button asChild>
                <Link href="/">Ir a mis clases</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Entraste como {v.user.email}.</p>
              <JoinButton token={token} teamName={info.teamName} />
            </div>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
