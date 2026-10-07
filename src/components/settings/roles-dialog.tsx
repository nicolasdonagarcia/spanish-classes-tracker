"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveRoles } from "@/app/actions";
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
import type { RoleDef } from "@/lib/types";

interface Draft {
  key: string;
  id?: string;
  name: string;
  rate: string;
}

const toDrafts = (roles: RoleDef[]): Draft[] =>
  roles.map((r) => ({ key: r.id, id: r.id, name: r.name, rate: r.rate === null ? "" : String(r.rate) }));

export function RolesDialog({ roles, trigger }: { roles: RoleDef[]; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>(() => toDrafts(roles));
  const [pending, start] = useTransition();

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDrafts(toDrafts(roles));
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Tags />
            Roles y tarifas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await saveRoles(
                drafts.map((d) => ({
                  id: d.id,
                  name: d.name,
                  rate: d.rate.trim() === "" ? null : Number(d.rate),
                }))
              );
              if (!res.ok) return void toast.error(res.error);
              toast.success("Roles y tarifas guardados");
              setOpen(false);
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Roles y tarifas</DialogTitle>
            <DialogDescription>
              Al registrar una clase, cada profesor/a elige su rol y la tarifa por hora se aplica sola (menos
              su retención, si tiene una).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <div className="grid grid-cols-[1fr_8rem_2.25rem] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
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
              onClick={() =>
                setDrafts((list) => [...list, { key: `new-${Date.now()}`, name: "", rate: "" }])
              }
            >
              <Plus />
              Agregar rol
            </Button>
          </div>

          <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Los cambios aplican a las clases nuevas. Las clases ya registradas mantienen su tarifa.
          </p>

          <DialogFooter>
            <Button type="submit" disabled={pending} className="w-full sm:w-auto">
              {pending && <Loader2 className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
