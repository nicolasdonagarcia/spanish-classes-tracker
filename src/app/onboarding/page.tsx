import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { CreateTeamForm, SignOutButton } from "@/components/team-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getViewer } from "@/lib/session";

export default async function OnboardingPage() {
  const v = await getViewer();
  if (!v) redirect("/login");
  if (v.member) redirect("/");

  return (
    <AuthShell>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Hola, {v.user.name.split(" ")[0]}</CardTitle>
            <CardDescription>
              ¿Eres jefe/a? Crea tu equipo para invitar a tus profesores y ver sus horas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTeamForm />
          </CardContent>
        </Card>
        <div className="flex gap-3 rounded-xl border border-dashed bg-card/50 p-4 text-sm text-muted-foreground">
          <MessageCircle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-medium text-foreground">¿Eres profesor/a?</span> Abre el enlace de
            invitación que te envió tu jefe/a por WhatsApp.
          </p>
        </div>
        <div className="flex justify-center">
          <SignOutButton />
        </div>
      </div>
    </AuthShell>
  );
}
