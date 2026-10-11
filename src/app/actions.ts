"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { classes, profiles, type ClassDoc } from "@/lib/db";
import { exportQuery, getPricing, toRow } from "@/lib/data";
import { addDays, computeHours, isMonth, round2 } from "@/lib/format";
import { effectiveRate } from "@/lib/roles";
import { requireUser } from "@/lib/session";
import type { ActionResult, ExportData, ExportFilter, Pricing, RoleDef } from "@/lib/types";

const fail = (error: string) => ({ ok: false as const, error });
const done = () => revalidatePath("/", "layout");
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/* ───────────────────────────── Ajustes ───────────────────────────── */

const settingsInput = z.object({
  roles: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        name: z.string().trim().min(1, "Cada rol necesita un nombre").max(40, "Nombre de rol muy largo"),
        rate: z.number().min(0, "La tarifa no puede ser negativa").max(10000).nullable(),
      })
    )
    .min(1, "Debe haber al menos un rol")
    .max(20, "Máximo 20 roles"),
  retention: z
    .number()
    .min(0, "La retención debe estar entre 0 y 100%")
    .max(100, "La retención debe estar entre 0 y 100%")
    .nullable(),
});

/** Her roles + hourly rates and her retention %. */
export async function saveSettings(input: z.input<typeof settingsInput>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos");

  const seen = new Set<string>();
  const roles: RoleDef[] = [];
  for (const r of parsed.data.roles) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return fail(`El rol "${r.name}" está repetido.`);
    seen.add(key);
    roles.push({ id: r.id || randomUUID().slice(0, 8), name: r.name, rate: r.rate === null ? null : round2(r.rate) });
  }
  const now = new Date();
  await profiles.updateOne(
    { _id: user.id },
    {
      $set: { roles, retention: round2(parsed.data.retention ?? 0), updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );
  done();
  return { ok: true };
}

/* ───────────────────────────── Classes ───────────────────────────── */

const classInput = z.object({
  id: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida"),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Hora de inicio no válida"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Hora de fin no válida"),
  family: z.string().trim().min(1, "Escribe la familia o el lugar").max(80),
  roleId: z.string({ error: "Elige el rol de la clase" }).min(1, "Elige el rol de la clase"),
  note: z.string().trim().max(500).optional().default(""),
});

export type ClassInput = z.input<typeof classInput>;

/** Rate comes from her saved roles, minus her retention — computed here, never trusted from the browser. */
function priceFor(pricing: Pricing, roleId: string) {
  const role = pricing.roles.find((r) => r.id === roleId);
  if (!role) return fail("Elige el rol de la clase.");
  if (role.rate === null) return fail(`Primero define la tarifa de ${role.name} en Ajustes.`);
  return {
    ok: true as const,
    fields: {
      roleId: role.id,
      role: role.name,
      baseRate: role.rate,
      retention: pricing.retention,
      rate: effectiveRate(role.rate, pricing.retention),
    },
  };
}

export async function saveClass(input: ClassInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = classInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  const hours = computeHours(d.start, d.end);
  if (hours <= 0) return fail("La hora de fin debe ser después de la de inicio.");
  const pricing = priceFor(await getPricing(user.id), d.roleId);
  if (!pricing.ok) return pricing;
  const fields = {
    date: d.date,
    month: d.date.slice(0, 7),
    start: d.start,
    end: d.end,
    hours,
    family: d.family,
    ...pricing.fields,
    amount: round2(hours * pricing.fields.rate),
    note: d.note,
    updatedAt: new Date(),
  };

  if (d.id) {
    const _id = oid(d.id);
    if (!_id) return fail("Clase no encontrada.");
    const res = await classes.updateOne({ _id, userId: user.id, status: "pending" }, { $set: fields });
    if (!res.matchedCount) return fail("Para editar una clase pagada, primero márcala como pendiente.");
  } else {
    await classes.insertOne({
      _id: new ObjectId(),
      userId: user.id,
      ...fields,
      status: "pending",
      paidAt: null,
      createdAt: new Date(),
    });
  }
  done();
  return { ok: true };
}

export async function deleteClass(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const _id = oid(id);
  if (!_id) return fail("Clase no encontrada.");
  const res = await classes.deleteOne({ _id, userId: user.id, status: "pending" });
  if (!res.deletedCount) return fail("Para borrar una clase pagada, primero márcala como pendiente.");
  done();
  return { ok: true };
}

export async function duplicateNextWeek(id: string): Promise<ActionResult<{ date: string }>> {
  const user = await requireUser();
  const _id = oid(id);
  if (!_id) return fail("Clase no encontrada.");
  const c = await classes.findOne({ _id, userId: user.id });
  if (!c) return fail("Clase no encontrada.");
  const date = addDays(c.date, 7);
  const now = new Date();
  // Use today's rate for the role if possible; otherwise keep the original numbers.
  const pricing = c.roleId ? priceFor(await getPricing(user.id), c.roleId) : null;
  const price = pricing?.ok
    ? pricing.fields
    : { roleId: c.roleId, role: c.role, baseRate: c.baseRate, retention: c.retention, rate: c.rate };
  await classes.insertOne({
    _id: new ObjectId(),
    userId: user.id,
    date,
    month: date.slice(0, 7),
    start: c.start,
    end: c.end,
    hours: c.hours,
    family: c.family,
    ...price,
    amount: round2(c.hours * price.rate),
    note: "",
    status: "pending",
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  });
  done();
  return { ok: true, date };
}

/* ───────────────────────────── Paid / pending ───────────────────────────── */

const scopeInput = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(1000) }),
  z.object({ month: z.string().refine(isMonth, "Mes no válido") }),
]);

/** Mark classes as paid (paid = true) or back to pending. By ids or a whole month. */
export async function setPaid(
  scope: z.input<typeof scopeInput>,
  paid: boolean
): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const parsed = scopeInput.safeParse(scope);
  if (!parsed.success) return fail("Nada que actualizar.");
  const filter: Filter<ClassDoc> = { userId: user.id, status: paid ? "pending" : "paid" };
  if ("ids" in parsed.data) {
    filter._id = { $in: parsed.data.ids.map(oid).filter((x): x is ObjectId => !!x) };
  } else {
    filter.month = parsed.data.month;
  }
  const now = new Date();
  const res = await classes.updateMany(filter, {
    $set: paid
      ? { status: "paid", paidAt: now, updatedAt: now }
      : { status: "pending", paidAt: null, updatedAt: now },
  });
  done();
  return { ok: true, count: res.modifiedCount };
}

/* ───────────────────────────── PDF export ───────────────────────────── */

const filterInput = z.union([
  z.object({ ids: z.array(z.string()).min(1).max(2000) }),
  z.object({
    from: z.string(),
    to: z.string(),
    status: z.enum(["all", "pending", "paid"]),
    family: z.string().max(80),
  }),
]);

/** Quick count + total for the export dialog. */
export async function previewExport(
  f: ExportFilter
): Promise<ActionResult<{ count: number; hours: number; total: number }>> {
  const user = await requireUser();
  const parsed = filterInput.safeParse(f);
  if (!parsed.success) return fail("Filtros no válidos");
  const { filter } = exportQuery(user.id, parsed.data);
  const [agg] = await classes
    .aggregate<{ count: number; hours: number; total: number }>([
      { $match: filter },
      { $group: { _id: null, count: { $sum: 1 }, hours: { $sum: "$hours" }, total: { $sum: "$amount" } } },
    ])
    .toArray();
  return { ok: true, count: agg?.count ?? 0, hours: round2(agg?.hours ?? 0), total: round2(agg?.total ?? 0) };
}

/** Rows for the PDF (generated in the browser). */
export async function getExportData(f: ExportFilter): Promise<ActionResult<{ data: ExportData }>> {
  const user = await requireUser();
  const parsed = filterInput.safeParse(f);
  if (!parsed.success) return fail("Filtros no válidos");
  const { filter, scope } = exportQuery(user.id, parsed.data);
  const docs = await classes.find(filter).sort({ date: 1, start: 1 }).limit(2000).toArray();
  return {
    ok: true,
    data: { scope, rows: docs.map(toRow) },
  };
}
