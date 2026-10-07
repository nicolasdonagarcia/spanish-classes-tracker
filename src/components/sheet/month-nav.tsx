import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monthLabel, shiftMonth } from "@/lib/format";

export function MonthNav({ month, current }: { month: string; current: string }) {
  return (
    <div className="flex items-center gap-1">
      <Button asChild variant="outline" size="icon" aria-label="Mes anterior">
        <Link href={`?mes=${shiftMonth(month, -1)}`} scroll={false}>
          <ChevronLeft />
        </Link>
      </Button>
      <h2 className="min-w-36 text-center text-lg font-semibold tabular-nums">{monthLabel(month)}</h2>
      <Button asChild variant="outline" size="icon" aria-label="Mes siguiente">
        <Link href={`?mes=${shiftMonth(month, 1)}`} scroll={false}>
          <ChevronRight />
        </Link>
      </Button>
      {month !== current && (
        <Button asChild variant="ghost" size="sm" className="ml-1">
          <Link href={`?mes=${current}`} scroll={false}>
            Mes actual
          </Link>
        </Button>
      )}
    </div>
  );
}
