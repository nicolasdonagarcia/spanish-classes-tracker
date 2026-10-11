"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveClass } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeHours, hoursLabel, money, round2, weekdayLabel } from "@/lib/format";
import { effectiveRate, percent } from "@/lib/roles";
import type { ClassRow, FamilySuggestion, RoleDef } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  date: string;
  start: string;
  end: string;
  family: string;
  roleId: string;
  note: string;
}

function initialState(row: ClassRow | null, defaultDate: string, roles: RoleDef[]): FormState {
  if (row)
    return {
      date: row.date,
      start: row.start,
      end: row.end,
      family: row.family,
      roleId: roles.some((r) => r.id === row.roleId && r.rate !== null) ? row.roleId! : "",
      note: row.note,
    };
  return { date: defaultDate, start: "14:00", end: "16:00", family: "", roleId: "", note: "" };
}

export function ClassDialog({
  open,
  onOpenChange,
  row,
  defaultDate,
  families,
  roles,
  retention,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → new class */
  row: ClassRow | null;
  defaultDate: string;
  families: FamilySuggestion[];
  roles: RoleDef[];
  /** Teacher's retention % */
  retention: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {open && (
          <ClassForm
            key={row?.id ?? "new"}
            row={row}
            defaultDate={defaultDate}
            families={families}
            roles={roles}
            retention={retention}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClassForm({
  row,
  defaultDate,
  families,
  roles,
  retention,
  onDone,
}: {
  row: ClassRow | null;
  defaultDate: string;
  families: FamilySuggestion[];
  roles: RoleDef[];
  retention: number;
  onDone: () => void;
}) {
  const [f, setF] = useState<FormState>(() => initialState(row, defaultDate, roles));
  const [pending, start] = useTransition();
  const set = (patch: Partial<FormState>) => setF((s) => ({ ...s, ...patch }));

  const hours = computeHours(f.start, f.end);
  const role = roles.find((r) => r.id === f.roleId && r.rate !== null);
  const baseRate = role?.rate ?? 0;
  const rate = role ? effectiveRate(baseRate, retention) : 0;
  const total = round2(hours * rate);
  const noRates = roles.every((r) => r.rate === null);
  const roleName = (id: string | null) => roles.find((r) => r.id === id)?.name;

  const suggestions = useMemo(() => {
    const q = f.family.trim().toLowerCase();
    return families
      .filter((x) => x.name.toLowerCase() !== q && (!q || x.name.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [families, f.family]);

  function pickFamily(s: FamilySuggestion) {
    const usable = roles.some((r) => r.id === s.roleId && r.rate !== null);
    set({
      family: s.name,
      ...(usable ? { roleId: s.roleId! } : {}),
      ...(row ? {} : { start: s.start, end: s.end }),
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveClass({ id: row?.id, ...f });
          if (!res.ok) return void toast.error(res.error);
          toast.success(row ? "Clase actualizada" : "Clase agregada");
          onDone();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>{row ? "Editar clase" : "Agregar clase"}</DialogTitle>
        <DialogDescription>
          Las horas y el total se calculan solos.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="family">Familia o lugar</Label>
        <Input
          id="family"
          value={f.family}
          onChange={(e) => set({ family: e.target.value })}
          placeholder="Familia García"
          autoComplete="off"
          required
        />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.name}
                onClick={() => pickFamily(s)}
                className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                {s.name}
                {roleName(s.roleId) ? ` · ${roleName(s.roleId)}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label id="role-label">Rol en esta clase</Label>
        <div role="radiogroup" aria-labelledby="role-label" className="grid grid-cols-2 gap-2">
          {roles.map((r) => {
            const disabled = r.rate === null;
            const selected = f.roleId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => set({ roleId: r.id })}
                className={cn(
                  "grid gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                  disabled && "cursor-not-allowed opacity-50 hover:bg-transparent"
                )}
              >
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {r.name}
                  {selected && <Check className="size-4" />}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {r.rate === null ? "Tarifa por definir" : `${money(effectiveRate(r.rate, retention))}/h`}
                </span>
              </button>
            );
          })}
        </div>
        {noRates && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Todavía no definiste tus tarifas. Ciérralo y toca <span className="font-medium">Ajustes</span> para
            definirlas.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="date">Fecha</Label>
        <div className="flex items-center gap-3">
          <Input
            id="date"
            type="date"
            value={f.date}
            onChange={(e) => set({ date: e.target.value })}
            required
            className="w-auto flex-1"
          />
          <span className="w-20 text-sm capitalize text-muted-foreground">
            {/^\d{4}-\d{2}-\d{2}$/.test(f.date) ? weekdayLabel(f.date) : ""}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="start">Desde</Label>
          <Input id="start" type="time" step={300} value={f.start} onChange={(e) => set({ start: e.target.value })} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end">Hasta</Label>
          <Input id="end" type="time" step={300} value={f.end} onChange={(e) => set({ end: e.target.value })} required />
        </div>
      </div>

      <div
        className={cn(
          "grid gap-0.5 rounded-lg border px-3 py-2.5 text-sm",
          hours > 0 ? "bg-muted/40" : "border-destructive/40 bg-destructive/5"
        )}
      >
        {hours <= 0 ? (
          <span className="text-destructive">La hora &quot;hasta&quot; debe ser después de &quot;desde&quot;.</span>
        ) : !role ? (
          <span className="text-muted-foreground">
            {hoursLabel(hours)} · elige un rol para calcular el total.
          </span>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                {hoursLabel(hours)} × {money(rate)}
              </span>
              <span className="text-base font-semibold tabular-nums">{money(total)}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {role.name} {money(baseRate)}/h
              {retention > 0 ? ` − ${percent(retention)} de retención` : ""}
            </span>
          </>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="note">Nota (opcional)</Label>
        <Textarea
          id="note"
          value={f.note}
          onChange={(e) => set({ note: e.target.value })}
          rows={2}
          placeholder="Ej. clase de repaso"
        />
      </div>

      <DialogFooter>
        <Button type="submit" size="lg" disabled={pending || hours <= 0 || !role} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}
