import "server-only";
import { ObjectId, type Filter } from "mongodb";
import { classes, profiles, type ClassDoc } from "@/lib/db";
import { dateLong, monthShort, shiftMonth } from "@/lib/format";
import { withDefaultRoles } from "@/lib/roles";
import type { ChartPoint, ClassRow, ExportFilter, FamilySuggestion, Pricing } from "@/lib/types";

/** Her roles/rates and retention (defaults until she saves Ajustes). */
export async function getPricing(userId: string): Promise<Pricing> {
  const p = await profiles.findOne({ _id: userId });
  return { roles: withDefaultRoles(p?.roles), retention: p?.retention ?? 0 };
}

export function toRow(c: ClassDoc): ClassRow {
  return {
    id: c._id.toHexString(),
    date: c.date,
    start: c.start,
    end: c.end,
    hours: c.hours,
    family: c.family,
    roleId: c.roleId ?? null,
    role: c.role ?? null,
    baseRate: c.baseRate ?? null,
    retention: c.retention ?? 0,
    rate: c.rate,
    amount: c.amount,
    note: c.note ?? "",
    status: c.status,
    paidAt: c.paidAt ? new Date(c.paidAt).toISOString() : null,
  };
}

/** 12 bars ending at the current month (or the selected one, if later/earlier than the window). */
function chartWindow(selected: string, current: string) {
  let end = selected > current ? selected : current;
  if (selected < shiftMonth(end, -11)) end = shiftMonth(selected, 11);
  return Array.from({ length: 12 }, (_, i) => shiftMonth(end, i - 11));
}

export async function getSheet(userId: string, month: string, current: string) {
  const months = chartWindow(month, current);

  const [docs, totals, families, allFamilies, pricing] = await Promise.all([
    classes.find({ userId, month }).sort({ date: 1, start: 1 }).toArray(),
    classes
      .aggregate<{ _id: { month: string; status: string }; amount: number }>([
        { $match: { userId, month: { $in: months } } },
        { $group: { _id: { month: "$month", status: "$status" }, amount: { $sum: "$amount" } } },
      ])
      .toArray(),
    classes
      .aggregate<{ _id: string; roleId: string | null; start: string; end: string }>([
        { $match: { userId } },
        { $sort: { date: -1, start: -1 } },
        {
          $group: {
            _id: "$family",
            roleId: { $first: "$roleId" },
            start: { $first: "$start" },
            end: { $first: "$end" },
            last: { $first: "$date" },
          },
        },
        { $sort: { last: -1 } },
        { $limit: 30 },
      ])
      .toArray(),
    classes.distinct("family", { userId }),
    getPricing(userId),
  ]);

  const chart: ChartPoint[] = months.map((m) => ({
    month: m,
    label: monthShort(m),
    paid: totals.find((t) => t._id.month === m && t._id.status === "paid")?.amount ?? 0,
    pending: totals.find((t) => t._id.month === m && t._id.status === "pending")?.amount ?? 0,
  }));

  const familySuggestions: FamilySuggestion[] = families.map((f) => ({
    name: f._id,
    roleId: f.roleId ?? null,
    start: f.start,
    end: f.end,
  }));

  return {
    rows: docs.map(toRow),
    chart,
    families: familySuggestions,
    allFamilies: (allFamilies as string[]).sort((a, b) => a.localeCompare(b, "es")),
    pricing,
  };
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const STATUS_LABEL = { all: "Todas", pending: "Pendientes", paid: "Pagadas" } as const;

/** Mongo filter + human description for an export / preview. */
export function exportQuery(userId: string, f: ExportFilter) {
  if ("ids" in f) {
    const ids = f.ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    return {
      filter: { userId, _id: { $in: ids } } as Filter<ClassDoc>,
      scope: { title: `Clases seleccionadas (${ids.length})`, details: [] as string[] },
    };
  }
  const filter: Filter<ClassDoc> = { userId };
  const range: { $gte?: string; $lte?: string } = {};
  if (isDay(f.from)) range.$gte = f.from;
  if (isDay(f.to)) range.$lte = f.to;
  if (range.$gte || range.$lte) filter.date = range;
  if (f.status === "pending" || f.status === "paid") filter.status = f.status;
  if (f.family) filter.family = f.family;

  const period =
    range.$gte && range.$lte
      ? `${dateLong(range.$gte)} – ${dateLong(range.$lte)}`
      : range.$gte
        ? `Desde el ${dateLong(range.$gte)}`
        : range.$lte
          ? `Hasta el ${dateLong(range.$lte)}`
          : "Todas las fechas";
  const details = [`Estado: ${STATUS_LABEL[f.status] ?? "Todas"}`];
  if (f.family) details.push(`Familia o lugar: ${f.family}`);
  return { filter, scope: { title: period, details } };
}
