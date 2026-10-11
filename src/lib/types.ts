/** A class role (e.g. Maestra, Helper) with its hourly rate. */
export interface RoleDef {
  id: string;
  name: string;
  /** null = not defined yet */
  rate: number | null;
}

export interface Pricing {
  roles: RoleDef[];
  /** Retention % subtracted from the role rate */
  retention: number;
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
  paidAt: string | null;
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

export type StatusFilter = "all" | "pending" | "paid";

/** What to put in a PDF: either picked rows, or a filter. */
export type ExportFilter =
  | { ids: string[] }
  | { from: string; to: string; status: StatusFilter; family: string };

export interface ExportData {
  /** Human-readable description of what was exported */
  scope: { title: string; details: string[] };
  rows: ClassRow[];
}

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
