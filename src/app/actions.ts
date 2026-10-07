"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ObjectId, type Filter } from "mongodb";
import { z } from "zod";
import { classes, invites, members, teams, type ClassDoc } from "@/lib/db";
import { resolveTeacher } from "@/lib/data";
import { addDays, computeHours, isMonth, round2 } from "@/lib/format";
import { DEFAULT_ROLES, effectiveRate, teamRoles } from "@/lib/roles";
import { getViewer, requireMember, type MemberViewer } from "@/lib/session";
import type { ActionResult, Role, RoleDef } from "@/lib/types";

const fail = (error: string) => ({ ok: false as const, error });
const done = () => {
  revalidatePath("/", "layout");
};
const oid = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

/* ───────────────────────────── Team & invites ───────────────────────────── */

export async function createTeam(name: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return fail("Inicia sesión primero.");
  if (v.member) return fail("Ya perteneces a un equipo.");
  const clean = name.trim().slice(0, 60);
  if (!clean) return fail("Escribe un nombre para tu equipo.");
  const now = new Date();
  const { insertedId } = await teams.insertOne({
    _id: new ObjectId(),
    name: clean,
    ownerId: v.user.id,
    roles: DEFAULT_ROLES,
    createdAt: now,
  });
  try {
    await members.insertOne({
      _id: new ObjectId(),
      teamId: insertedId,
      userId: v.user.id,
      role: "boss",
      createdAt: now,
    });
  } catch {
    await teams.deleteOne({ _id: insertedId });
    return fail("Ya perteneces a un equipo.");
  }
  done();
  return { ok: true };
}

async function requireBoss() {
  const v = await requireMember();
  if (v.member.role !== "boss") throw new Error("Solo el jefe/a puede hacer esto.");
  return v;
}

export async function createInvite(name: string): Promise<ActionResult<{ token: string }>> {
  const v = await requireBoss();
  const token = randomBytes(18).toString("base64url");
  const now = new Date();
  await invites.insertOne({
    _id: new ObjectId(),
    token,
    teamId: v.team._id,
    createdBy: v.user.id,
    name: name.trim().slice(0, 60) || undefined,
    createdAt: now,
    expiresAt: new Date(now.getTime() + 14 * 24 * 3600 * 1000),
  });
  done();
  return { ok: true, token };
}

export async function revokeInvite(id: string): Promise<ActionResult> {
  const v = await requireBoss();
  const _id = oid(id);
  if (!_id) return fail("Invitación no válida.");
  await invites.deleteOne({ _id, teamId: v.team._id, usedBy: { $exists: false } });
  done();
  return { ok: true };
}

export async function acceptInvite(token: string): Promise<ActionResult> {
  const v = await getViewer();
  if (!v) return fail("Inicia sesión primero.");
  if (v.member) return fail("Ya perteneces a un equipo.");
  const invite = await invites.findOneAndUpdate(
    { token, usedBy: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedBy: v.user.id, usedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!invite) return fail("Este enlace ya fue usado o expiró. Pide uno nuevo.");
  try {
    await members.insertOne({
      _id: new ObjectId(),
      teamId: invite.teamId,
      userId: v.user.id,
      role: "teacher",
      createdAt: new Date(),
    });
  } catch {
    return fail("Ya perteneces a un equipo.");
  }
  done();
  return { ok: true };
}

export async function removeTeacher(teacherId: string): Promise<ActionResult> {
  const v = await requireBoss();
  await members.deleteOne({ teamId: v.team._id, userId: teacherId, role: "teacher" });
  done();
  return { ok: true };
}

/* ───────────────────────────── Boss settings ───────────────────────────── */

const rolesInput = z
  .array(
    z.object({
      id: z.string().max(40).optional(),
      name: z.string().trim().min(1, "Cada rol necesita un nombre").max(40, "Nombre de rol muy largo"),
      rate: z.number().min(0, "La tarifa no puede ser negativa").max(10000).nullable(),
    })
  )
  .min(1, "Debe haber al menos un rol")
  .max(20, "Máximo 20 roles");

/** Replace the team's list of class roles and hourly rates. */
export async function saveRoles(input: z.input<typeof rolesInput>): Promise<ActionResult> {
  const v = await requireBoss();
  const parsed = rolesInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const seen = new Set<string>();
  const roles: RoleDef[] = [];
  for (const r of parsed.data) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) return fail(`El rol "${r.name}" está repetido.`);
    seen.add(key);
    roles.push({
      id: r.id || randomUUID().slice(0, 8),
      name: r.name,
      rate: r.rate === null ? null : round2(r.rate),
    });
  }
  await teams.updateOne({ _id: v.team._id }, { $set: { roles } });
  done();
  return { ok: true };
}

/** Per-teacher settings. For now: retention % subtracted from the role rate. */
export async function saveTeacherSettings(
  teacherId: string,
  settings: { retention: number | null }
): Promise<ActionResult> {
  const v = await requireBoss();
  const retention = settings.retention ?? 0;
  if (!Number.isFinite(retention) || retention < 0 || retention > 100)
    return fail("La retención debe estar entre 0 y 100%.");
  const res = await members.updateOne(
    { teamId: v.team._id, userId: teacherId, role: "teacher" },
    { $set: { retention: round2(retention) } }
  );
  if (!res.matchedCount) return fail("Profesor/a no encontrado.");
  done();
  return { ok: true };
}

/* ───────────────────────────── Classes (teacher) ───────────────────────────── */

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

/** Rate comes from the boss's role table, minus the teacher's retention — never from the client. */
function priceFor(v: MemberViewer, roleId: string) {
  const role = teamRoles(v.team.roles).find((r) => r.id === roleId);
  if (!role) return fail("Elige el rol de la clase.");
  if (role.rate === null) return fail(`Tu jefe/a todavía no definió la tarifa de ${role.name}.`);
  const retention = v.member.retention ?? 0;
  return {
    ok: true as const,
    fields: {
      roleId: role.id,
      role: role.name,
      baseRate: role.rate,
      retention,
      rate: effectiveRate(role.rate, retention),
    },
  };
}

async function requireTeacher() {
  const v = await requireMember();
  if (v.member.role !== "teacher") throw new Error("Solo el profesor/a puede editar clases.");
  return v;
}

export async function saveClass(input: ClassInput): Promise<ActionResult> {
  const v = await requireTeacher();
  const parsed = classInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos no válidos");
  const d = parsed.data;
  const hours = computeHours(d.start, d.end);
  if (hours <= 0) return fail("La hora de fin debe ser después de la de inicio.");
  const pricing = priceFor(v, d.roleId);
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
    // Editing clears any pending payment request — the other side must re-confirm.
    const res = await classes.updateOne(
      { _id, teamId: v.team._id, teacherId: v.user.id, status: "pending" },
      { $set: { ...fields, request: null } }
    );
    if (!res.matchedCount) return fail("No se puede editar una clase pagada.");
  } else {
    await classes.insertOne({
      _id: new ObjectId(),
      teamId: v.team._id,
      teacherId: v.user.id,
      ...fields,
      status: "pending",
      request: null,
      comments: [],
      createdAt: new Date(),
    });
  }
  done();
  return { ok: true };
}

export async function deleteClass(id: string): Promise<ActionResult> {
  const v = await requireTeacher();
  const _id = oid(id);
  if (!_id) return fail("Clase no encontrada.");
  const res = await classes.deleteOne({ _id, teamId: v.team._id, teacherId: v.user.id, status: "pending" });
  if (!res.deletedCount) return fail("No se puede borrar una clase pagada.");
  done();
  return { ok: true };
}

export async function duplicateNextWeek(id: string): Promise<ActionResult<{ date: string }>> {
  const v = await requireTeacher();
  const _id = oid(id);
  if (!_id) return fail("Clase no encontrada.");
  const c = await classes.findOne({ _id, teamId: v.team._id, teacherId: v.user.id });
  if (!c) return fail("Clase no encontrada.");
  const date = addDays(c.date, 7);
  const now = new Date();
  // Use today's rate for the role if available; otherwise keep the original numbers.
  const pricing = c.roleId ? priceFor(v, c.roleId) : null;
  const price =
    pricing?.ok
      ? pricing.fields
      : { roleId: c.roleId, role: c.role, baseRate: c.baseRate, retention: c.retention, rate: c.rate };
  await classes.insertOne({
    _id: new ObjectId(),
    teamId: c.teamId,
    teacherId: c.teacherId,
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
    request: null,
    comments: [],
    createdAt: now,
    updatedAt: now,
  });
  done();
  return { ok: true, date };
}

/* ───────────────────────────── Payment flow (both) ───────────────────────────── */

const scopeInput = z.object({
  teacherId: z.string().min(1),
  ids: z.array(z.string()).max(500).optional(),
  month: z.string().optional(),
});
type Scope = z.input<typeof scopeInput>;

async function scopeFilter(v: MemberViewer, input: Scope): Promise<Filter<ClassDoc> | null> {
  const parsed = scopeInput.safeParse(input);
  if (!parsed.success) return null;
  const { teacherId, ids, month } = parsed.data;
  if (!(await resolveTeacher(v, teacherId))) return null;
  const filter: Filter<ClassDoc> = { teamId: v.team._id, teacherId, status: "pending" };
  if (ids?.length) {
    const oids = ids.map(oid).filter((x): x is ObjectId => !!x);
    filter._id = { $in: oids };
  } else if (isMonth(month)) {
    filter.month = month;
  } else {
    return null;
  }
  return filter;
}

/** "Mark as paid" — asks the other party to confirm. */
export async function requestPayment(input: Scope): Promise<ActionResult<{ count: number }>> {
  const v = await requireMember();
  const filter = await scopeFilter(v, input);
  if (!filter) return fail("No autorizado.");
  const res = await classes.updateMany(
    { ...filter, request: null },
    {
      $set: {
        request: { by: v.member.role, userId: v.user.id, name: v.user.name, at: new Date() },
        updatedAt: new Date(),
      },
    }
  );
  done();
  return { ok: true, count: res.modifiedCount };
}

/** The other party confirms → PAID. Only works on requests made by the other side. */
export async function confirmPayment(input: Scope): Promise<ActionResult<{ count: number }>> {
  const v = await requireMember();
  const filter = await scopeFilter(v, input);
  if (!filter) return fail("No autorizado.");
  const other: Role = v.member.role === "boss" ? "teacher" : "boss";
  const now = new Date();
  const res = await classes.updateMany(
    { ...filter, "request.by": other },
    { $set: { status: "paid", paidAt: now, updatedAt: now } }
  );
  done();
  return { ok: true, count: res.modifiedCount };
}

/** Undo own request, or reject the other side's request. Back to plain PENDING. */
export async function cancelRequest(input: Scope): Promise<ActionResult> {
  const v = await requireMember();
  const filter = await scopeFilter(v, input);
  if (!filter) return fail("No autorizado.");
  await classes.updateMany(
    { ...filter, request: { $ne: null } },
    { $set: { request: null, updatedAt: new Date() } }
  );
  done();
  return { ok: true };
}

/* ───────────────────────────── Comments (both) ───────────────────────────── */

export async function addComment(classId: string, text: string): Promise<ActionResult> {
  const v = await requireMember();
  const clean = text.trim().slice(0, 1000);
  if (!clean) return fail("Escribe un comentario.");
  const _id = oid(classId);
  if (!_id) return fail("Clase no encontrada.");
  const c = await classes.findOne({ _id, teamId: v.team._id });
  if (!c || !(await resolveTeacher(v, c.teacherId))) return fail("Clase no encontrada.");
  await classes.updateOne(
    { _id },
    {
      $push: {
        comments: {
          id: randomUUID(),
          userId: v.user.id,
          name: v.user.name,
          role: v.member.role,
          text: clean,
          at: new Date(),
        },
      },
    }
  );
  done();
  return { ok: true };
}
