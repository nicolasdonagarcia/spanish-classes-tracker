import "server-only";
import { ObjectId } from "mongodb";
import { classes, invites, members, teams, users, type ClassDoc } from "@/lib/db";
import { monthShort, shiftMonth } from "@/lib/format";
import type { MemberViewer } from "@/lib/session";
import { teamRoles } from "@/lib/roles";
import type { ChartPoint, ClassRow, FamilySuggestion, Role } from "@/lib/types";

const toObjectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

export async function getUserNames(ids: string[]) {
  const oids = ids.map(toObjectId).filter((x): x is ObjectId => !!x);
  const docs = oids.length ? await users.find({ _id: { $in: oids } }).toArray() : [];
  return new Map(docs.map((u) => [u._id.toHexString(), u.name]));
}

export async function getUserName(id: string) {
  return (await getUserNames([id])).get(id) ?? "—";
}

/** Returns the teacher's id if the viewer may see this teacher's sheet. */
export async function resolveTeacher(v: MemberViewer, teacherId: string) {
  if (v.member.role === "teacher") return teacherId === v.user.id ? teacherId : null;
  const m = await members.findOne({ teamId: v.team._id, userId: teacherId, role: "teacher" });
  return m ? teacherId : null;
}

export interface TeacherListItem {
  id: string;
  name: string;
  pendingAmount: number;
  awaitingBoss: number;
  retention: number;
}

export async function getTeachers(teamId: ObjectId): Promise<TeacherListItem[]> {
  const list = await members.find({ teamId, role: "teacher" }).sort({ createdAt: 1 }).toArray();
  const ids = list.map((m) => m.userId);
  const names = await getUserNames(ids);
  const stats = ids.length
    ? await classes
        .aggregate<{ _id: string; pendingAmount: number; awaitingBoss: number }>([
          { $match: { teamId, teacherId: { $in: ids }, status: "pending" } },
          {
            $group: {
              _id: "$teacherId",
              pendingAmount: { $sum: "$amount" },
              awaitingBoss: { $sum: { $cond: [{ $eq: ["$request.by", "teacher"] }, 1, 0] } },
            },
          },
        ])
        .toArray()
    : [];
  const byId = new Map(stats.map((s) => [s._id, s]));
  return list.map((m) => ({
    id: m.userId,
    name: names.get(m.userId) ?? "Sin nombre",
    pendingAmount: byId.get(m.userId)?.pendingAmount ?? 0,
    awaitingBoss: byId.get(m.userId)?.awaitingBoss ?? 0,
    retention: m.retention ?? 0,
  }));
}

export async function getPendingInvites(teamId: ObjectId) {
  const list = await invites
    .find({ teamId, usedBy: { $exists: false }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .toArray();
  return list.map((i) => ({
    id: i._id.toHexString(),
    token: i.token,
    name: i.name ?? "",
    createdAt: i.createdAt.toISOString(),
  }));
}

function toRow(c: ClassDoc, viewerId: string): ClassRow {
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
    request: c.request
      ? { by: c.request.by, name: c.request.name, at: new Date(c.request.at).toISOString() }
      : null,
    paidAt: c.paidAt ? new Date(c.paidAt).toISOString() : null,
    comments: (c.comments ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      text: m.text,
      at: new Date(m.at).toISOString(),
      mine: m.userId === viewerId,
    })),
  };
}

/** 12 bars ending at the current month (or the selected one, if later/earlier than the window). */
function chartWindow(selected: string, current: string) {
  let end = selected > current ? selected : current;
  if (selected < shiftMonth(end, -11)) end = shiftMonth(selected, 11);
  return Array.from({ length: 12 }, (_, i) => shiftMonth(end, i - 11));
}

export async function getSheet(v: MemberViewer, teacherId: string, month: string, current: string) {
  const teamId = v.team._id;
  const role: Role = v.member.role;
  const otherRole: Role = role === "boss" ? "teacher" : "boss";
  const base = { teamId, teacherId };

  const months = chartWindow(month, current);

  const [docs, totals, awaitingAgg, families, teacherMember] = await Promise.all([
    classes.find({ ...base, month }).sort({ date: 1, start: 1 }).toArray(),
    classes
      .aggregate<{ _id: { month: string; status: string }; amount: number }>([
        { $match: { ...base, month: { $in: months } } },
        { $group: { _id: { month: "$month", status: "$status" }, amount: { $sum: "$amount" } } },
      ])
      .toArray(),
    classes
      .aggregate<{ _id: string; count: number; amount: number }>([
        { $match: { ...base, status: "pending", "request.by": otherRole } },
        { $group: { _id: "$month", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    role === "teacher"
      ? classes
          .aggregate<{ _id: string; roleId: string | null; start: string; end: string }>([
            { $match: base },
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
          .toArray()
      : Promise.resolve([]),
    members.findOne({ teamId, userId: teacherId }),
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
    rows: docs.map((d) => toRow(d, v.user.id)),
    chart,
    awaiting: {
      count: awaitingAgg.reduce((s, a) => s + a.count, 0),
      amount: awaitingAgg.reduce((s, a) => s + a.amount, 0),
      months: awaitingAgg.map((a) => a._id),
    },
    families: familySuggestions,
    roles: teamRoles(v.team.roles),
    /** The teacher's retention % (set by the boss). */
    retention: teacherMember?.retention ?? 0,
  };
}

export async function getInviteInfo(token: string) {
  const invite = await invites.findOne({ token });
  if (!invite) return null;
  const team = await teams.findOne({ _id: invite.teamId });
  if (!team) return null;
  const valid = !invite.usedBy && invite.expiresAt > new Date();
  return {
    valid,
    name: invite.name ?? "",
    teamName: team.name,
    bossName: await getUserName(team.ownerId),
  };
}
