import Link from "next/link";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money, monthLabel } from "@/lib/format";

export function AwaitingBanner({
  count,
  amount,
  months,
  selected,
  otherName,
}: {
  count: number;
  amount: number;
  months: string[];
  selected: string;
  otherName: string;
}) {
  if (!count) return null;
  const elsewhere = months.filter((m) => m !== selected);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center">
      <BellRing className="hidden size-5 shrink-0 text-amber-600 sm:block" />
      <p className="flex-1 text-sm">
        <span className="font-semibold">{otherName.split(" ")[0]}</span> marcó{" "}
        {count === 1 ? "1 clase" : `${count} clases`} como pagada{count === 1 ? "" : "s"} ({money(amount)}).{" "}
        {months.includes(selected) ? "Revisa y confirma abajo." : "Revisa y confirma."}
      </p>
      {elsewhere.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {elsewhere.map((m) => (
            <Button key={m} asChild size="sm" variant="outline" className="border-amber-300 bg-white">
              <Link href={`?mes=${m}`} scroll={false}>
                Ver {monthLabel(m).toLowerCase()}
              </Link>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
