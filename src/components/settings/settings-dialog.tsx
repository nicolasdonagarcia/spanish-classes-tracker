"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import { effectiveRate, percent } from "@/lib/roles";
import type { Pricing } from "@/lib/types";

interface Draft {
  key: string;
  id?: string;
  name: string;
  rate: string;
}

export function SettingsDialog({ pricing, trigger }: { pricing: Pricing; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label="Ajustes">
            <Settings />
            <span className="hidden sm:inline">Ajustes</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {open && <SettingsForm pricing={pricing} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({ pricing, onDone }: { pricing: Pricing; onDone: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    pricing.roles.map((r) => ({ key: r.id, id: r.id, name: r.name, rate: r.rate === null ? "" : String(r.rate) }))
  );
  const [retention, setRetention] = useState(pricing.retention ? String(pricing.retention) : "");
  const [pending, start] = useTransition();

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const pct = Math.min(100, Math.max(0, Number(retention) || 0));
  const priced = drafts.filter((d) => d.name.trim() && d.rate.trim() !== "" && Number(d.rate) >= 0);

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettings({
            roles: drafts.map((d) => ({
              id: d.id,
              name: d.name,
              rate: d.rate.trim() === "" ? null : Number(d.rate),
            })),
            retention: retention.trim() === "" ? null : Number(retention),
          });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Ajustes guardados");
          onDone();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>Ajustes</DialogTitle>
        <DialogDescription>
          Al registrar una clase eliges el rol y la tarifa se aplica sola (menos tu retención, si tienes).
        </DialogDescription>
      </DialogHeader>

      <section className="grid gap-2">
        <h3 className="text-sm font-medium">Roles y tarifas por hora</h3>
        <div className="grid grid-cols-[1fr_8rem_2.25rem] gap-2 px-0.5 text-xs text-muted-foreground">
          <span>Rol</span>
          <span>Tarifa por hora</span>
          <span />
        </div>
        {drafts.map((d, i) => (
          <div key={d.key} className="grid grid-cols-[1fr_8rem_2.25rem] items-center gap-2">
            <Input
              aria-label={`Nombre del rol ${i + 1}`}
              value={d.name}
              onChange={(e) => update(d.key, { name: e.target.value })}
              placeholder="Ej. Maestra"
              required
            />
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                aria-label={`Tarifa de ${d.name || `rol ${i + 1}`}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={d.rate}
                onChange={(e) => update(d.key, { rate: e.target.value })}
                placeholder="Por definir"
                className="pl-7"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Quitar ${d.name || "rol"}`}
              disabled={drafts.length === 1}
              onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setDrafts((list) => [...list, { key: `new-${list.length}-${Math.random()}`, name: "", rate: "" }])}
        >
          <Plus />
          Agregar rol
        </Button>
      </section>

      <section className="grid gap-2">
        <Label htmlFor="retention">Retención (opcional)</Label>
        <div className="relative w-40">
          <Input
            id="retention"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            placeholder="0"
            className="pr-8"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        <p className="text-xs text-muted-foreground">Se descuenta de la tarifa del rol en cada clase.</p>
        {priced.length > 0 && (
          <ul className="grid gap-1 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            {priced.map((d) => (
              <li key={d.key} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="text-muted-foreground">
                  {d.name} {money(Number(d.rate))}/h{pct > 0 ? ` − ${percent(pct)}` : ""}
                </span>
                <span className="font-medium">{money(effectiveRate(Number(d.rate), pct))}/h</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Los cambios aplican a las clases nuevas. Las ya registradas mantienen su tarifa.
      </p>

      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}
