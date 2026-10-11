"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { previewExport } from "@/app/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadReport } from "@/lib/export-client";
import { hoursLabel, money, monthBounds, monthLabel, shiftMonth } from "@/lib/format";
import type { ExportFilter, StatusFilter } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = "__all";

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExportDialog({ month, families }: { month: string; families: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="Exportar PDF">
          <FileDown />
          <span className="hidden sm:inline">Exportar PDF</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md">
        {open && <ExportForm month={month} families={families} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type Preset = "month" | "prev" | "year" | "all" | "custom";

function ExportForm({ month, families, onDone }: { month: string; families: string[]; onDone: () => void }) {
  const year = month.slice(0, 4);
  const ranges: Record<Exclude<Preset, "custom">, { from: string; to: string }> = {
    month: monthBounds(month),
    prev: monthBounds(shiftMonth(month, -1)),
    year: { from: `${year}-01-01`, to: `${year}-12-31` },
    all: { from: "", to: "" },
  };

  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(ranges.month.from);
  const [to, setTo] = useState(ranges.month.to);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [family, setFamily] = useState(ALL);
  const [preview, setPreview] = useState<{ count: number; hours: number; total: number } | null>(null);
  const [loading, startPreview] = useTransition();
  const [downloading, setDownloading] = useState(false);
  const reqId = useRef(0);

  const filter: ExportFilter = { from, to, status, family: family === ALL ? "" : family };
  const key = JSON.stringify(filter);

  useEffect(() => {
    const id = ++reqId.current;
    startPreview(async () => {
      const res = await previewExport(JSON.parse(key) as ExportFilter);
      if (id === reqId.current) setPreview(res.ok ? res : null);
    });
  }, [key]);

  function pickPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      setFrom(ranges[p].from);
      setTo(ranges[p].to);
    }
  }

  async function download() {
    setDownloading(true);
    const res = await downloadReport(filter);
    setDownloading(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success("PDF descargado");
    onDone();
  }

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Exportar PDF</DialogTitle>
        <DialogDescription>
          Elige qué clases incluir. También puedes seleccionar clases en la tabla y exportarlas.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label>Periodo</Label>
        <Segmented
          label="Periodo"
          value={preset}
          onChange={pickPreset}
          options={[
            { value: "month", label: monthLabel(month) },
            { value: "prev", label: monthLabel(shiftMonth(month, -1)) },
            { value: "year", label: `Año ${year}` },
            { value: "all", label: "Todo" },
            { value: "custom", label: "Otras fechas" },
          ]}
        />
        {preset === "custom" && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="grid gap-1.5">
              <Label htmlFor="exp-from" className="text-xs text-muted-foreground">
                Desde
              </Label>
              <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="exp-to" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Estado</Label>
        <Segmented
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todas" },
            { value: "pending", label: "Pendientes" },
            { value: "paid", label: "Pagadas" },
          ]}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="exp-family">Familia o lugar</Label>
        <Select value={family} onValueChange={setFamily}>
          <SelectTrigger id="exp-family" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {families.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex min-h-11 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm" aria-live="polite">
        {loading && !preview ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : preview && preview.count > 0 ? (
          <>
            <span className="flex-1 text-muted-foreground">
              {preview.count} {preview.count === 1 ? "clase" : "clases"} · {hoursLabel(preview.hours)}
            </span>
            <span className="font-semibold tabular-nums">{money(preview.total)}</span>
          </>
        ) : (
          <span className="text-muted-foreground">No hay clases con estos filtros.</span>
        )}
      </div>

      <DialogFooter>
        <Button onClick={download} disabled={downloading || !preview?.count} className="w-full sm:w-auto">
          {downloading ? <Loader2 className="animate-spin" /> : <FileDown />}
          Descargar PDF
        </Button>
      </DialogFooter>
    </div>
  );
}
