import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { AwaitingBanner } from "@/components/sheet/awaiting-banner";
import { AddClassButton, ClassSheet } from "@/components/sheet/class-sheet";
import { EarningsChart } from "@/components/sheet/earnings-chart";
import { MonthNav } from "@/components/sheet/month-nav";
import { MonthSummary } from "@/components/sheet/summary";
import { MissingRatesBanner } from "@/components/settings/missing-rates-banner";
import { TeacherActions } from "@/components/settings/teacher-actions";
import { getSheet, getUserNames, resolveTeacher } from "@/lib/data";
import { currentMonth, isMonth, todayISO } from "@/lib/format";
import { requireMember } from "@/lib/session";
import type { SheetContext } from "@/lib/types";

export default async function SheetPage({ params, searchParams }: PageProps<"/t/[teacherId]">) {
  const v = await requireMember();
  const { teacherId } = await params;
  const { mes } = await searchParams;
  if (!(await resolveTeacher(v, teacherId))) notFound();

  const current = currentMonth();
  const month = isMonth(mes) ? mes : current;
  const isTeacher = v.member.role === "teacher";

  const [names, sheet] = await Promise.all([
    getUserNames([teacherId, v.team.ownerId]),
    getSheet(v, teacherId, month, current),
  ]);
  const teacherName = names.get(teacherId) ?? "Profesor/a";
  const bossName = names.get(v.team.ownerId) ?? "Jefe/a";

  const ctx: SheetContext = {
    role: v.member.role,
    teacherId,
    teacherName,
    bossName,
    otherName: isTeacher ? bossName : teacherName,
    month,
  };

  const pricing = { roles: sheet.roles, retention: sheet.retention };
  const today = todayISO();
  const defaultDate = today.startsWith(month) ? today : `${month}-01`;

  return (
    <>
      <PageHeader
        withSidebar={!isTeacher}
        title={isTeacher ? "Mis clases" : teacherName}
        subtitle={isTeacher ? `Compartido con ${bossName}` : "Hoja de clases"}
      >
        {isTeacher ? (
          <AddClassButton families={sheet.families} defaultDate={defaultDate} pricing={pricing} />
        ) : (
          <TeacherActions
            variant="header"
            teacherId={teacherId}
            name={teacherName}
            retention={sheet.retention}
            roles={sheet.roles}
          />
        )}
      </PageHeader>

      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:px-6 md:py-6">
        {!isTeacher && <MissingRatesBanner roles={sheet.roles} />}
        <AwaitingBanner {...sheet.awaiting} selected={month} otherName={ctx.otherName} />
        <EarningsChart data={sheet.chart} selected={month} />
        <MonthNav month={month} current={current} />
        <MonthSummary rows={sheet.rows} />
        <ClassSheet
          rows={sheet.rows}
          ctx={ctx}
          families={sheet.families}
          defaultDate={defaultDate}
          pricing={pricing}
        />
      </main>
    </>
  );
}
