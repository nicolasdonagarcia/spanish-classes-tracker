"use client";

import { useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  Clock,
  CopyPlus,
  FileDown,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { deleteClass, duplicateNextWeek, setPaid } from "@/app/actions";
import { ClassDialog } from "@/components/sheet/class-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadReport } from "@/lib/export-client";
import { dateLabel, hoursLabel, money, monthLabel, round2, scheduleLabel, TIMEZONE } from "@/lib/format";
import { percent } from "@/lib/roles";
import type { ClassRow, FamilySuggestion, Pricing } from "@/lib/types";
import { cn } from "@/lib/utils";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const sum = (list: ClassRow[]) => round2(list.reduce((s, r) => s + r.amount, 0));

/* ─────────────────────────────── Add button ─────────────────────────────── */

export function AddClassButton({
  families,
  defaultDate,
  pricing,
  className,
}: {
  families: FamilySuggestion[];
  defaultDate: string;
  pricing: Pricing;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus />
        Agregar clase
      </Button>
      <ClassDialog
        open={open}
        onOpenChange={setOpen}
        row={null}
        defaultDate={defaultDate}
        families={families}
        {...pricing}
      />
    </>
  );
}

/* ─────────────────────────────── Bits ─────────────────────────────── */

function RetentionNote({ row, className }: { row: ClassRow; className?: string }) {
  if (!row.retention || row.baseRate === null) return null;
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      −{percent(row.retention)} de {money(row.baseRate)}
    </span>
  );
}

function PaidStatus({ row }: { row: ClassRow }) {
  const [pending, start] = useTransition();

  if (row.status === "paid") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle2 />
          Pagado
        </Badge>
        {row.paidAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(row.paidAt).toLocaleDateString("es-US", { day: "numeric", month: "short", timeZone: TIMEZONE })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        <Clock />
        Pendiente
      </Badge>
      <Button
        size="xs"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setPaid({ ids: [row.id] }, true);
            if (!res.ok) toast.error(res.error);
            else toast.success("Marcada como pagada");
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Marcar pagado
      </Button>
    </div>
  );
}

function RowMenu({ row, onEdit, onDelete }: { row: ClassRow; onEdit: () => void; onDelete: () => void }) {
  const isPending = row.status === "pending";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Opciones">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isPending ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Editar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={async () => {
              const res = await setPaid({ ids: [row.id] }, false);
              if (!res.ok) return void toast.error(res.error);
              toast.success("Marcada como pendiente");
            }}
          >
            <Undo2 />
            Marcar como pendiente
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            const res = await duplicateNextWeek(row.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Copiada al ${dateLabel(res.date)}`);
          }}
        >
          <CopyPlus />
          Repetir la próxima semana
        </DropdownMenuItem>
        {isPending && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MarkMonthPaid({ rows, month }: { rows: ClassRow[]; month: string }) {
  const [pending, start] = useTransition();
  const open = rows.filter((r) => r.status === "pending");
  if (!open.length) return null;
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check />}
          Marcar mes como pagado
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Marcar {monthLabel(month).toLowerCase()} como pagado?</AlertDialogTitle>
          <AlertDialogDescription>
            {plural(open.length, "clase pendiente", "clases pendientes")} por {money(sum(open))} quedarán como
            pagadas. Puedes deshacerlo en cada clase.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              start(async () => {
                const res = await setPaid({ month }, true);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`${plural(res.count, "clase marcada", "clases marcadas")} como pagada${res.count === 1 ? "" : "s"}`);
              })
            }
          >
            Sí, marcar pagado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ─────────────────────────────── Selection bar ─────────────────────────────── */

function SelectionBar({ rows, onClear }: { rows: ClassRow[]; onClear: () => void }) {
  const [busy, setBusy] = useState<null | "paid" | "pending" | "pdf">(null);
  const pendingRows = rows.filter((r) => r.status === "pending");
  const paidRows = rows.filter((r) => r.status === "paid");

  async function mark(paid: boolean) {
    setBusy(paid ? "paid" : "pending");
    const ids = (paid ? pendingRows : paidRows).map((r) => r.id);
    const res = await setPaid({ ids }, paid);
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      `${plural(res.count, "clase marcada", "clases marcadas")} como ${paid ? "pagada" : "pendiente"}${res.count === 1 ? "" : "s"}`
    );
    onClear();
  }

  async function pdf() {
    setBusy("pdf");
    const res = await downloadReport({ ids: rows.map((r) => r.id) });
    setBusy(null);
    if (!res.ok) toast.error(res.error);
  }

  return (
    <div
      role="region"
      aria-label="Clases seleccionadas"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-2xl flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-2 pl-4 shadow-lg backdrop-blur">
        <div className="mr-auto text-sm">
          <span className="font-semibold">{plural(rows.length, "seleccionada", "seleccionadas")}</span>
          <span className="text-muted-foreground"> · {money(sum(rows))}</span>
        </div>
        {pendingRows.length > 0 && (
          <Button size="sm" onClick={() => mark(true)} disabled={!!busy}>
            {busy === "paid" ? <Loader2 className="animate-spin" /> : <Check />}
            Marcar pagado
          </Button>
        )}
        {paidRows.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => mark(false)} disabled={!!busy}>
            {busy === "pending" ? <Loader2 className="animate-spin" /> : <Undo2 />}
            Pendiente
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={pdf} disabled={!!busy}>
          {busy === "pdf" ? <Loader2 className="animate-spin" /> : <FileDown />}
          PDF
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={onClear} aria-label="Quitar selección">
          <X />
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Sheet ─────────────────────────────── */

export function ClassSheet({
  rows,
  month,
  families,
  defaultDate,
  pricing,
}: {
  rows: ClassRow[];
  month: string;
  families: FamilySuggestion[];
  defaultDate: string;
  pricing: Pricing;
}) {
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [deletePending, startDelete] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Keep only ids that still exist (rows change after actions).
  const selected = rows.filter((r) => selectedIds.has(r.id));
  const allChecked = rows.length > 0 && selected.length === rows.length;
  const someChecked = selected.length > 0 && !allChecked;
  const toggle = (id: string, on: boolean) =>
    setSelectedIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (on: boolean) => setSelectedIds(on ? new Set(rows.map((r) => r.id)) : new Set());

  const totalHours = round2(rows.reduce((s, r) => s + r.hours, 0));
  const totalAmount = sum(rows);

  const actions = (r: ClassRow) => (
    <RowMenu row={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
  );

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", selected.length > 0 && "mb-32 md:mb-20")}>
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="grid gap-1">
          <CardTitle className="text-base">Clases de {monthLabel(month).toLowerCase()}</CardTitle>
          <CardDescription>
            {rows.length
              ? `${plural(rows.length, "clase", "clases")} · ${hoursLabel(totalHours)} · ${money(totalAmount)}`
              : "Sin clases este mes"}
          </CardDescription>
        </div>
        <MarkMonthPaid rows={rows} month={month} />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <p className="text-muted-foreground">Aún no registraste clases este mes.</p>
          <AddClassButton families={families} defaultDate={defaultDate} pricing={pricing} />
        </div>
      ) : (
        <>
          {/* Desktop: spreadsheet */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 pl-5">
                    <Checkbox
                      aria-label="Seleccionar todas"
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                    />
                  </TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Familia / lugar</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pl-6">Estado</TableHead>
                  <TableHead className="w-12 pr-4">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isSel = selectedIds.has(r.id);
                  return (
                    <TableRow key={r.id} data-state={isSel ? "selected" : undefined}>
                      <TableCell className="pl-5">
                        <Checkbox
                          aria-label={`Seleccionar ${r.family} ${dateLabel(r.date)}`}
                          checked={isSel}
                          onCheckedChange={(v) => toggle(r.id, v === true)}
                        />
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{dateLabel(r.date)}</TableCell>
                      <TableCell className="max-w-56">
                        <div className="truncate">{r.family}</div>
                        {r.note && <div className="truncate text-xs text-muted-foreground">{r.note}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.role ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {scheduleLabel(r.start, r.end)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{hoursLabel(r.hours)}</TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        <div>{money(r.rate)}</div>
                        <RetentionNote row={r} className="block whitespace-nowrap" />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(r.amount)}</TableCell>
                      <TableCell className="pl-6">
                        <PaidStatus row={r} />
                      </TableCell>
                      <TableCell className="pr-4">{actions(r)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  <TableCell colSpan={4}>Total del mes</TableCell>
                  <TableCell className="text-right tabular-nums">{hoursLabel(totalHours)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{money(totalAmount)}</TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Mobile: one card per class */}
          <ul className="divide-y md:hidden">
            <li className="flex items-center gap-3 bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
              <Checkbox
                aria-label="Seleccionar todas"
                checked={allChecked ? true : someChecked ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAll(v === true)}
              />
              Seleccionar todas
            </li>
            {rows.map((r) => {
              const isSel = selectedIds.has(r.id);
              return (
                <li key={r.id} className={cn("flex gap-3 px-4 py-3", isSel && "bg-muted/60")}>
                  <Checkbox
                    className="mt-1"
                    aria-label={`Seleccionar ${r.family} ${dateLabel(r.date)}`}
                    checked={isSel}
                    onCheckedChange={(v) => toggle(r.id, v === true)}
                  />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.family}</p>
                        <p className="text-sm text-muted-foreground">
                          {dateLabel(r.date)} · {scheduleLabel(r.start, r.end)}
                        </p>
                        {r.note && <p className="truncate text-xs text-muted-foreground">{r.note}</p>}
                      </div>
                      <div className="-mt-1 -mr-2 shrink-0">{actions(r)}</div>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {r.role && <span className="font-medium text-foreground">{r.role} · </span>}
                        {hoursLabel(r.hours)} × {money(r.rate)}{" "}
                        <RetentionNote row={r} className="whitespace-nowrap" />
                      </span>
                      <span className="font-semibold tabular-nums">{money(r.amount)}</span>
                    </div>
                    <PaidStatus row={r} />
                  </div>
                </li>
              );
            })}
            <li className="flex items-baseline justify-between bg-muted/40 px-4 py-3 text-sm font-medium">
              <span>Total del mes · {hoursLabel(totalHours)}</span>
              <span className="tabular-nums">{money(totalAmount)}</span>
            </li>
          </ul>
        </>
      )}

      {selected.length > 0 && <SelectionBar rows={selected} onClear={() => setSelectedIds(new Set())} />}

      <ClassDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        row={editing}
        defaultDate={defaultDate}
        families={families}
        {...pricing}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta clase?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${deleting.family} · ${dateLabel(deleting.date)} · ${money(deleting.amount)}. No se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deletePending}
              onClick={() =>
                deleting &&
                startDelete(async () => {
                  const res = await deleteClass(deleting.id);
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Clase eliminada");
                  setDeleting(null);
                })
              }
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
