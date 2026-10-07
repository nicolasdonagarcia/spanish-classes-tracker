export type Role = "boss" | "teacher";

/** A class role defined by the boss (e.g. Maestra, Helper) with its hourly rate. */
export interface RoleDef {
  id: string;
  name: string;
  /** null = not defined yet by the boss */
  rate: number | null;
}

export interface ClassRow {
  id: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  family: string;
  /** Class role at the time of saving (null for old records). */
  roleId: string | null;
  role: string | null;
  /** Role rate before retention. */
  baseRate: number | null;
  /** Retention % applied to baseRate. */
  retention: number;
  /** Effective hourly rate (after retention). */
  rate: number;
  amount: number;
  note: string;
  status: "pending" | "paid";
  request: { by: Role; name: string; at: string } | null;
  paidAt: string | null;
  comments: { id: string; name: string; role: Role; text: string; at: string; mine: boolean }[];
}

export interface ChartPoint {
  month: string;
  label: string;
  paid: number;
  pending: number;
}

export interface FamilySuggestion {
  name: string;
  roleId: string | null;
  start: string;
  end: string;
}

export interface SheetContext {
  /** Who is looking at the sheet. */
  role: Role;
  teacherId: string;
  teacherName: string;
  bossName: string;
  /** Name of the other party (boss for teachers, teacher for bosses). */
  otherName: string;
  month: string;
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
