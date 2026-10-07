"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, MoreHorizontal, Settings, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { removeTeacher, saveTeacherSettings } from "@/app/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarMenuAction } from "@/components/ui/sidebar";
import { money } from "@/lib/format";
import { effectiveRate, percent } from "@/lib/roles";
import type { RoleDef } from "@/lib/types";

export interface TeacherActionsProps {
  teacherId: string;
  name: string;
  retention: number;
  roles: RoleDef[];
  /** "sidebar" renders the ⋯ inside a sidebar item; "header" a regular icon button. */
  variant: "sidebar" | "header";
}

export function TeacherActions({ teacherId, name, retention, roles, variant }: TeacherActionsProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const trigger =
    variant === "sidebar" ? (
      <SidebarMenuAction className="top-3!" aria-label={`Opciones de ${name}`}>
        <MoreHorizontal />
      </SidebarMenuAction>
    ) : (
      <Button variant="ghost" size="icon" aria-label={`Opciones de ${name}`}>
        <MoreHorizontal />
      </Button>
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "right" : "bottom"}>
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings />
            Configuración
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
            <UserMinus />
            Quitar del equipo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TeacherSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        teacherId={teacherId}
        name={name}
        retention={retention}
        roles={roles}
      />
      <RemoveTeacherDialog open={removeOpen} onOpenChange={setRemoveOpen} teacherId={teacherId} name={name} />
    </>
  );
}

function TeacherSettingsDialog({
  open,
  onOpenChange,
  teacherId,
  name,
  retention,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  name: string;
  retention: number;
  roles: RoleDef[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SettingsForm
            teacherId={teacherId}
            name={name}
            retention={retention}
            roles={roles}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  teacherId,
  name,
  retention,
  roles,
  onDone,
}: {
  teacherId: string;
  name: string;
  retention: number;
  roles: RoleDef[];
  onDone: () => void;
}) {
  const [value, setValue] = useState(retention ? String(retention) : "");
  const [pending, start] = useTransition();
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const priced = roles.filter((r): r is RoleDef & { rate: number } => r.rate !== null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveTeacherSettings(teacherId, {
            retention: value.trim() === "" ? null : Number(value),
          });
          if (!res.ok) return void toast.error(res.error);
          toast.success("Configuración guardada");
          onDone();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>Configuración de {name}</DialogTitle>
        <DialogDescription>Ajustes que solo aplican a este profesor/a.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label htmlFor="retention">Retención (opcional)</Label>
        <div className="relative w-40">
          <Input
            id="retention"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0"
            className="pr-8"
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Se descuenta de la tarifa del rol en cada clase que registre.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
        {priced.length === 0 ? (
          <p className="text-muted-foreground">
            Define primero las tarifas en <span className="font-medium text-foreground">Roles y tarifas</span>.
          </p>
        ) : (
          <ul className="grid gap-1">
            {priced.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="text-muted-foreground">
                  {r.name} {money(r.rate)}/h{pct > 0 ? ` − ${percent(pct)}` : ""}
                </span>
                <span className="font-medium">{money(effectiveRate(r.rate, pct))}/h</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Las clases ya registradas mantienen su tarifa.</p>

      <DialogFooter>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending && <Loader2 className="animate-spin" />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  );
}

function RemoveTeacherDialog({
  open,
  onOpenChange,
  teacherId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Quitar a {name} del equipo?</AlertDialogTitle>
          <AlertDialogDescription>
            Ya no verás su hoja y no podrá entrar a tu equipo. Sus clases se guardan; si la vuelves a invitar con
            la misma cuenta, volverán a aparecer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await removeTeacher(teacherId);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${name} ya no está en el equipo`);
                router.replace("/");
              })
            }
          >
            Quitar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
