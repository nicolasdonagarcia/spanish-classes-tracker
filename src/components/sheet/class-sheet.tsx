"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  CopyPlus,
  Hourglass,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addComment,
  cancelRequest,
  confirmPayment,
  deleteClass,
  duplicateNextWeek,
  requestPayment,
} from "@/app/actions";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  dateLabel,
  hoursLabel,
  money,
  monthLabel,
  round2,
  scheduleLabel,
  TIMEZONE,
} from "@/lib/format";
import { percent } from "@/lib/roles";
import type { ClassRow, FamilySuggestion, Role, RoleDef, SheetContext } from "@/lib/types";
import { cn } from "@/lib/utils";

const firstName = (n: string) => n.split(" ")[0] ?? n;
const otherOf = (r: Role): Role => (r === "boss" ? "teacher" : "boss");
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Role rates (from the boss) and the teacher's retention — used by the add/edit dialog. */
export interface Pricing {
  roles: RoleDef[];
  retention: number;
}

function RetentionNote({ row, className }: { row: ClassRow; className?: string }) {
  if (!row.retention || row.baseRate === null) return null;
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      −{percent(row.retention)} de {money(row.baseRate)}
    </span>
  );
}

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

/* ─────────────────────────────── Status ─────────────────────────────── */

function StatusBadge({ row, role }: { row: ClassRow; role: Role }) {
  if (row.status === "paid")
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-800">
        <CheckCircle2 />
        Pagado
      </Badge>
    );
  if (!row.request)
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
        <Clock />
        Pendiente
      </Badge>
    );
  if (row.request.by === role)
    return (
      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
        <Hourglass />
        Por confirmar
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900">
      <BellRing />
      Confirma tú
    </Badge>
  );
}

function PaymentStatus({ row, ctx }: { row: ClassRow; ctx: SheetContext }) {
  const [pending, start] = useTransition();
  const scope = { teacherId: ctx.teacherId, ids: [row.id] };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Algo salió mal");
      else toast.success(success);
    });

  const spinner = pending ? <Loader2 className="animate-spin" /> : null;

  if (row.status === "paid") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge row={row} role={ctx.role} />
        {row.paidAt && (
          <span className="text-xs text-muted-foreground">
            {new Date(row.paidAt).toLocaleDateString("es-US", { day: "numeric", month: "short", timeZone: TIMEZONE })}
          </span>
        )}
      </div>
    );
  }

  if (!row.request) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge row={row} role={ctx.role} />
        <Button
          size="xs"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => requestPayment(scope), `Le pedimos a ${firstName(ctx.otherName)} que confirme`)}
        >
          {spinner ?? <Check />}
          Marcar pagado
        </Button>
      </div>
    );
  }

  if (row.request.by === ctx.role) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge row={row} role={ctx.role} />
        <span className="text-xs text-muted-foreground">Esperando a {firstName(ctx.otherName)}</span>
        <Button
          size="xs"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => cancelRequest(scope), "Solicitud cancelada")}
        >
          {spinner ?? <Undo2 />}
          Deshacer
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-amber-900">
        <span className="font-medium">{firstName(row.request.name)}</span> lo marcó pagado
      </span>
      <Button
        size="xs"
        disabled={pending}
        onClick={() => run(() => confirmPayment(scope), "¡Pago confirmado!")}
      >
        {spinner ?? <Check />}
        Confirmar
      </Button>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => cancelRequest(scope), "Marcado como no pagado")}
        title="Todavía no se ha pagado"
      >
        <X />
        No
      </Button>
    </div>
  );
}

/* ─────────────────────────────── Comments ─────────────────────────────── */

function Comments({ row }: { row: ClassRow }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const count = row.comments.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Comentarios (${count})`}>
          <MessageSquare className={count ? "text-foreground" : "text-muted-foreground"} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Comentarios</p>
          <p className="text-xs text-muted-foreground">
            {row.family} · {dateLabel(row.date)}
          </p>
        </div>
        <div className="grid max-h-64 gap-3 overflow-y-auto px-4 py-3">
          {count === 0 && <p className="text-sm text-muted-foreground">Sin comentarios todavía.</p>}
          {row.comments.map((c) => (
            <div key={c.id} className={cn("grid gap-0.5", c.mine && "justify-items-end text-right")}>
              <p
                className={cn(
                  "max-w-[90%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                  c.mine ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {c.text}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {c.mine ? "Tú" : firstName(c.name)} ·{" "}
                {formatDistanceToNow(new Date(c.at), { locale: es, addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            start(async () => {
              const res = await addComment(row.id, text);
              if (!res.ok) return void toast.error(res.error);
              setText("");
            });
          }}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un comentario…"
            rows={1}
            className="min-h-9 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="Enviar">
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/* ─────────────────────────────── Row menu ─────────────────────────────── */

function RowMenu({
  row,
  onEdit,
  onDelete,
}: {
  row: ClassRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const editable = row.status === "pending";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Opciones">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {editable && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            Editar
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
        {editable && (
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

/* ─────────────────────────────── Month actions ─────────────────────────────── */

function ConfirmButton({
  label,
  icon,
  title,
  description,
  action,
  variant = "default",
  run,
}: {
  label: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  variant?: "default" | "outline";
  run: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => start(run)}>{action}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MonthActions({ rows, ctx }: { rows: ClassRow[]; ctx: SheetContext }) {
  const other = otherOf(ctx.role);
  const requestable = rows.filter((r) => r.status === "pending" && !r.request);
  const awaitingMe = rows.filter((r) => r.status === "pending" && r.request?.by === other);
  const awaitingThem = rows.filter((r) => r.status === "pending" && r.request?.by === ctx.role);
  const sum = (list: ClassRow[]) => round2(list.reduce((s, r) => s + r.amount, 0));
  const month = monthLabel(ctx.month);
  const otherFirst = firstName(ctx.otherName);
  const scope = { teacherId: ctx.teacherId, month: ctx.month };

  if (!requestable.length && !awaitingMe.length && !awaitingThem.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
      {awaitingThem.length > 0 && !awaitingMe.length && !requestable.length && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Hourglass className="size-3.5" />
          Esperando a {otherFirst} ({awaitingThem.length})
        </span>
      )}
      {requestable.length > 0 && (
        <ConfirmButton
          variant={awaitingMe.length ? "outline" : "default"}
          icon={<Check />}
          label="Marcar mes como pagado"
          title={`¿Marcar ${month} como pagado?`}
          description={`${plural(requestable.length, "clase", "clases")} por ${money(sum(requestable))}. ${otherFirst} tendrá que confirmarlo para que queden como PAGADAS.`}
          action="Marcar como pagado"
          run={async () => {
            const res = await requestPayment(scope);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`Listo. Le pedimos a ${otherFirst} que confirme ${plural(res.count, "clase", "clases")}.`);
          }}
        />
      )}
      {awaitingMe.length > 0 && (
        <ConfirmButton
          icon={<CheckCircle2 />}
          label={`Confirmar ${plural(awaitingMe.length, "pago", "pagos")}`}
          title={ctx.role === "teacher" ? `¿Recibiste ${money(sum(awaitingMe))}?` : `¿Confirmas que pagaste ${money(sum(awaitingMe))}?`}
          description={`${otherFirst} marcó ${plural(awaitingMe.length, "clase", "clases")} de ${month} como pagadas. Al confirmar quedarán como PAGADAS.`}
          action="Sí, confirmar"
          run={async () => {
            const res = await confirmPayment(scope);
            if (!res.ok) return void toast.error(res.error);
            toast.success(`¡${plural(res.count, "pago confirmado", "pagos confirmados")}!`);
          }}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────── Sheet ─────────────────────────────── */

export function ClassSheet({
  rows,
  ctx,
  families,
  defaultDate,
  pricing,
}: {
  rows: ClassRow[];
  ctx: SheetContext;
  families: FamilySuggestion[];
  defaultDate: string;
  pricing: Pricing;
}) {
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);
  const [deletePending, startDelete] = useTransition();
  const isTeacher = ctx.role === "teacher";
  const other = otherOf(ctx.role);
  const totalHours = round2(rows.reduce((s, r) => s + r.hours, 0));
  const totalAmount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const needsMe = (r: ClassRow) => r.status === "pending" && r.request?.by === other;

  const actions = (r: ClassRow) => (
    <div className="flex items-center justify-end">
      <Comments row={r} />
      {isTeacher && <RowMenu row={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />}
    </div>
  );

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <div className="grid gap-1">
          <CardTitle className="text-base">Clases de {monthLabel(ctx.month).toLowerCase()}</CardTitle>
          <CardDescription>
            {rows.length
              ? `${plural(rows.length, "clase", "clases")} · ${hoursLabel(totalHours)} · ${money(totalAmount)}`
              : "Sin clases este mes"}
          </CardDescription>
        </div>
        <MonthActions rows={rows} ctx={ctx} />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
          <p className="text-muted-foreground">
            {isTeacher ? "Aún no registraste clases este mes." : `${firstName(ctx.teacherName)} aún no registró clases este mes.`}
          </p>
          {isTeacher && <AddClassButton families={families} defaultDate={defaultDate} pricing={pricing} />}
        </div>
      ) : (
        <>
          {/* Desktop: spreadsheet */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-6">Fecha</TableHead>
                  <TableHead>Familia / lugar</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="pl-6">Estado</TableHead>
                  <TableHead className="w-20 pr-4">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={cn(needsMe(r) && "bg-amber-50/70 hover:bg-amber-50")}>
                    <TableCell className="pl-6 font-medium whitespace-nowrap">{dateLabel(r.date)}</TableCell>
                    <TableCell className="max-w-56">
                      <div className="truncate">{r.family}</div>
                      {r.note && <div className="truncate text-xs text-muted-foreground">{r.note}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.role ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{scheduleLabel(r.start, r.end)}</TableCell>
                    <TableCell className="text-right tabular-nums">{hoursLabel(r.hours)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      <div>{money(r.rate)}</div>
                      <RetentionNote row={r} className="block whitespace-nowrap" />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{money(r.amount)}</TableCell>
                    <TableCell className="pl-6">
                      <PaymentStatus row={r} ctx={ctx} />
                    </TableCell>
                    <TableCell className="pr-4">{actions(r)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="bg-muted/40">
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-6" colSpan={4}>
                    Total del mes
                  </TableCell>
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
            {rows.map((r) => (
              <li key={r.id} className={cn("grid gap-2 px-4 py-3", needsMe(r) && "bg-amber-50/70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.family}</p>
                    <p className="text-sm text-muted-foreground">
                      {dateLabel(r.date)} · {scheduleLabel(r.start, r.end)}
                    </p>
                    {r.note && <p className="truncate text-xs text-muted-foreground">{r.note}</p>}
                  </div>
                  <div className="-mr-2 -mt-1 shrink-0">{actions(r)}</div>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {r.role && <span className="font-medium text-foreground">{r.role} · </span>}
                    {hoursLabel(r.hours)} × {money(r.rate)} <RetentionNote row={r} className="whitespace-nowrap" />
                  </span>
                  <span className="font-semibold tabular-nums">{money(r.amount)}</span>
                </div>
                <PaymentStatus row={r} ctx={ctx} />
              </li>
            ))}
            <li className="flex items-baseline justify-between bg-muted/40 px-4 py-3 text-sm font-medium">
              <span>Total del mes · {hoursLabel(totalHours)}</span>
              <span className="tabular-nums">{money(totalAmount)}</span>
            </li>
          </ul>
        </>
      )}

      {isTeacher && (
        <>
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
        </>
      )}
    </Card>
  );
}
