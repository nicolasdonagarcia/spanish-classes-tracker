"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { acceptInvite, createTeam } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createTeam(name);
          if (!res.ok) return void toast.error(res.error);
          router.replace("/");
        });
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="team">Nombre del equipo o escuela</Label>
        <Input
          id="team"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Clases de español Ana"
          required
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Crear mi equipo
      </Button>
    </form>
  );
}

export function JoinButton({ token, teamName }: { token: string; teamName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await acceptInvite(token);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Te uniste a ${teamName}`);
          router.replace("/");
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      Unirme a {teamName}
    </Button>
  );
}

export function SignOutButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const router = useRouter();
  return (
    <Button
      variant={variant}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut />
      Cerrar sesión
    </Button>
  );
}
