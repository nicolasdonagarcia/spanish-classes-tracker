import { CheckCircle2, Clock, Timer, Wallet } from "lucide-react";
import { hoursLabel, money, round2 } from "@/lib/format";
import type { ClassRow } from "@/lib/types";

export function MonthSummary({ rows }: { rows: ClassRow[] }) {
  const hours = round2(rows.reduce((s, r) => s + r.hours, 0));
  const total = round2(rows.reduce((s, r) => s + r.amount, 0));
  const paid = round2(rows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0));
  const pending = round2(total - paid);

  const tiles = [
    { label: "Horas", value: hoursLabel(hours), icon: Timer, tone: "text-muted-foreground" },
    { label: "Total del mes", value: money(total), icon: Wallet, tone: "text-muted-foreground" },
    { label: "Pagado", value: money(paid), icon: CheckCircle2, tone: "text-green-700" },
    { label: "Pendiente", value: money(pending), icon: Clock, tone: "text-amber-600" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card px-4 py-3 shadow-xs">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <t.icon className={`size-3.5 ${t.tone}`} />
            {t.label}
          </div>
          <div className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{t.value}</div>
        </div>
      ))}
    </div>
  );
}
