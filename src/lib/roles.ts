import { round2 } from "@/lib/format";
import type { RoleDef } from "@/lib/types";

/** Roles every new account starts with. She sets the rates in Ajustes. */
export const DEFAULT_ROLES: RoleDef[] = [
  { id: "maestra", name: "Maestra", rate: null },
  { id: "helper", name: "Helper", rate: null },
];

export const withDefaultRoles = (roles?: RoleDef[] | null): RoleDef[] =>
  roles && roles.length ? roles : DEFAULT_ROLES;

/** Hourly rate after subtracting the retention %. */
export const effectiveRate = (base: number, retention: number) =>
  round2(base * (1 - (retention || 0) / 100));

const pctFmt = new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 });
export const percent = (n: number) => `${pctFmt.format(n)}%`;
