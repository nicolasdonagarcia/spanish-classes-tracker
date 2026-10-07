import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInviteInfo } from "@/lib/data";
import { getSession } from "@/lib/session";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { invite } = await searchParams;
  const token = typeof invite === "string" ? invite : undefined;
  if (await getSession()) redirect(token ? `/invite/${token}` : "/");
  const info = token ? await getInviteInfo(token) : null;

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Crea tu cuenta</CardTitle>
          <CardDescription>
            {info?.valid
              ? `${info.bossName} te invitó a ${info.teamName}.`
              : "Solo necesitas tu nombre, correo y una contraseña."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="signup" inviteToken={info?.valid ? token : undefined} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
