import { CircleAlert } from "lucide-react";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import type { Pricing } from "@/lib/types";

/** Shown until every role has an hourly rate. */
export function MissingRatesBanner({ pricing }: { pricing: Pricing }) {
  const missing = pricing.roles.filter((r) => r.rate === null);
  if (!missing.length) return null;
  const none = missing.length === pricing.roles.length;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center">
      <CircleAlert className="hidden size-5 shrink-0 text-amber-600 sm:block" />
      <p className="flex-1 text-sm">
        {none ? (
          <>
            <span className="font-semibold">Primero define tus tarifas por hora</span> (Maestra, Helper…) para poder
            registrar clases.
          </>
        ) : (
          <>
            Falta la tarifa de <span className="font-semibold">{missing.map((r) => r.name).join(", ")}</span>.
          </>
        )}
      </p>
      <SettingsDialog
        pricing={pricing}
        trigger={
          <Button size="sm" variant="outline" className="border-amber-300 bg-white">
            Definir tarifas
          </Button>
        }
      />
    </div>
  );
}
