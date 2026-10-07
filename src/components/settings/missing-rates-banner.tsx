import { CircleAlert } from "lucide-react";
import { RolesDialog } from "@/components/settings/roles-dialog";
import { Button } from "@/components/ui/button";
import type { RoleDef } from "@/lib/types";

/** Boss-only nudge: teachers can't log classes for a role until it has a rate. */
export function MissingRatesBanner({ roles }: { roles: RoleDef[] }) {
  const missing = roles.filter((r) => r.rate === null);
  if (!missing.length) return null;
  const names = missing.map((r) => r.name).join(", ");
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center">
      <CircleAlert className="hidden size-5 shrink-0 text-amber-600 sm:block" />
      <p className="flex-1 text-sm">
        Falta definir la tarifa de <span className="font-semibold">{names}</span>. Tus profesores no pueden registrar
        clases con ese rol hasta que la definas.
      </p>
      <RolesDialog
        roles={roles}
        trigger={
          <Button size="sm" variant="outline" className="border-amber-300 bg-white">
            Definir tarifas
          </Button>
        }
      />
    </div>
  );
}
