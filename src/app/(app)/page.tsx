import { ExportDialog } from "@/components/export/export-dialog";
import { MissingRatesBanner } from "@/components/settings/missing-rates-banner";
import { AddClassButton, ClassSheet } from "@/components/sheet/class-sheet";
import { EarningsChart } from "@/components/sheet/earnings-chart";
import { MonthNav } from "@/components/sheet/month-nav";
import { MonthSummary } from "@/components/sheet/summary";
import { getSheet } from "@/lib/data";
import { currentMonth, isMonth, todayISO } from "@/lib/format";
import { requireUser } from "@/lib/session";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const { mes } = await searchParams;
  const current = currentMonth();
  const month = isMonth(mes) ? mes : current;
  const sheet = await getSheet(user.id, month, current);

  const today = todayISO();
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  return (
    <>
      <div className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-2 px-4 py-2 md:px-6">
          <h1 className="flex-1 truncate text-lg font-semibold">Mis clases</h1>
          <ExportDialog month={month} families={sheet.allFamilies} />
          <AddClassButton families={sheet.families} defaultDate={defaultDate} pricing={sheet.pricing} />
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:px-6 md:py-6">
        <MissingRatesBanner pricing={sheet.pricing} />
        <EarningsChart data={sheet.chart} selected={month} />
        <MonthNav month={month} current={current} />
        <MonthSummary rows={sheet.rows} />
        <ClassSheet
          key={month}
          rows={sheet.rows}
          month={month}
          families={sheet.families}
          defaultDate={defaultDate}
          pricing={sheet.pricing}
        />
      </main>
    </>
  );
}
