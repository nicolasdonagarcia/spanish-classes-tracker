import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { InviteDialog } from "@/components/invite-dialog";
import { PageHeader } from "@/components/page-header";
import { RolesDialog } from "@/components/settings/roles-dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { teamRoles } from "@/lib/roles";
import { requireMember } from "@/lib/session";
import { cn } from "@/lib/utils";

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          done ? "bg-green-100 text-green-800" : "bg-primary text-primary-foreground"
        )}
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <div className="grid min-w-0 flex-1 gap-3">
        <h2 className="pt-1 font-semibold">{title}</h2>
        {children}
      </div>
    </li>
  );
}

export default async function TeamPage() {
  const v = await requireMember();
  if (v.member.role !== "boss") redirect("/");
  const roles = teamRoles(v.team.roles);
  const ratesDone = roles.every((r) => r.rate !== null);

  return (
    <>
      <PageHeader withSidebar title={v.team.name} subtitle="Tu equipo" />
      <div className="mx-auto grid w-full max-w-xl gap-6 px-4 py-10 md:py-16">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Prepara tu equipo</h1>
          <p className="text-muted-foreground">Dos pasos y tus profesores podrán empezar a registrar clases.</p>
        </div>
        <ol className="grid gap-3">
          <Step n={1} done={ratesDone} title="Define la tarifa por hora de cada rol">
            <ul className="grid gap-1 text-sm">
              {roles.map((r) => (
                <li key={r.id} className="flex justify-between gap-3 border-b border-dashed pb-1 last:border-0">
                  <span>{r.name}</span>
                  <span className={cn("tabular-nums", r.rate === null && "text-amber-700")}>
                    {r.rate === null ? "Por definir" : `${money(r.rate)}/h`}
                  </span>
                </li>
              ))}
            </ul>
            <RolesDialog
              roles={roles}
              trigger={
                <Button variant={ratesDone ? "outline" : "default"} className="justify-self-start">
                  {ratesDone ? "Editar roles y tarifas" : "Definir tarifas"}
                </Button>
              }
            />
          </Step>
          <Step n={2} done={false} title="Invita a tu primer profesor/a">
            <p className="text-sm text-muted-foreground">
              Crea un enlace y envíalo por WhatsApp. Cuando cree su cuenta, aparecerá en la barra lateral con su
              hoja de clases.
            </p>
            <div className="w-full max-w-xs">
              <InviteDialog team={v.team.name} />
            </div>
          </Step>
        </ol>
      </div>
    </>
  );
}
