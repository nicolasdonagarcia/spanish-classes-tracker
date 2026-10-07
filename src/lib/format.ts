import { format } from "date-fns";
import { es } from "date-fns/locale";

export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || "America/New_York";
export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "USD";

const moneyFmt = new Intl.NumberFormat("es-US", { style: "currency", currency: CURRENCY });
const moneyShortFmt = new Intl.NumberFormat("es-US", {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});
const numFmt = new Intl.NumberFormat("es-US", { maximumFractionDigits: 2 });

export const money = (n: number) => moneyFmt.format(n);
export const moneyShort = (n: number) => moneyShortFmt.format(n);
export const hoursLabel = (h: number) => `${numFmt.format(h)} h`;

/** Today as YYYY-MM-DD in the app timezone. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const currentMonth = () => todayISO().slice(0, 7);

export const isMonth = (m: unknown): m is string =>
  typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function parseDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-10" → "Octubre 2026" */
export const monthLabel = (month: string) =>
  capitalize(format(parseDay(`${month}-01`), "LLLL yyyy", { locale: es }));

/** "2026-10" → "Oct" */
export const monthShort = (month: string) =>
  capitalize(format(parseDay(`${month}-01`), "LLL", { locale: es }).replace(".", ""));

/** "2026-10-02" → "Vie 2 oct" */
export const dateLabel = (date: string) =>
  capitalize(format(parseDay(date), "EEE d MMM", { locale: es }).replace(/\./g, ""));

/** "2026-10-02" → "viernes" */
export const weekdayLabel = (date: string) => format(parseDay(date), "EEEE", { locale: es });

/** "2026-10-12" + 7 → "2026-10-19" */
export function addDays(date: string, days: number) {
  const d = parseDay(date);
  d.setDate(d.getDate() + days);
  return format(d, "yyyy-MM-dd");
}

/** "14:30" → "2:30 pm" ; "14:00" → "2 pm" */
export function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export const scheduleLabel = (start: string, end: string) =>
  `${timeLabel(start)} – ${timeLabel(end)}`;

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Hours between two HH:mm times (0 if invalid). */
export function computeHours(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return 0;
  const diff = toMinutes(end) - toMinutes(start);
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}
