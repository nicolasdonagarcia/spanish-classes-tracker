import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSession } from "@/lib/session";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { invite } = await searchParams;
  const token = typeof invite === "string" ? invite : undefined;
  if (await getSession()) redirect(token ? `/invite/${token}` : "/");

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Hola de nuevo</CardTitle>
          <CardDescription>Entra con tu correo y contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm mode="login" inviteToken={token} />
        </CardContent>
      </Card>
    </AuthShell>
  );
}
