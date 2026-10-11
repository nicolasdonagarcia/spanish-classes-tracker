// Builds the "Registro de clases" PDF in the browser (jsPDF + autotable).
// Uses the built-in Helvetica font, which covers Spanish accents (á, ñ, ¿, ¡) but not
// every Unicode symbol — keep text to Latin-1 (e.g. "-" instead of "−").
import { jsPDF } from "jspdf";
import { autoTable, type CellInput, type RowInput } from "jspdf-autotable";
import { dateLabel, dateLong, hoursLabel, money, monthLabel, round2, scheduleLabel, todayISO } from "@/lib/format";
import { percent } from "@/lib/roles";
import type { ClassRow, ExportData } from "@/lib/types";

const INK: [number, number, number] = [23, 23, 23];
const MUTED: [number, number, number] = [110, 110, 105];
const LINE: [number, number, number] = [225, 225, 220];
const SOFT: [number, number, number] = [244, 244, 241];
const GREEN: [number, number, number] = [0, 110, 0];
const AMBER: [number, number, number] = [160, 98, 0];

const M = 40; // page margin (pt)

const totals = (rows: ClassRow[]) => {
  const paid = rows.filter((r) => r.status === "paid");
  const amount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const paidAmount = round2(paid.reduce((s, r) => s + r.amount, 0));
  return {
    count: rows.length,
    hours: round2(rows.reduce((s, r) => s + r.hours, 0)),
    amount,
    paid: paidAmount,
    pending: round2(amount - paidAmount),
  };
};

/** A cell whose `secondary` part is drawn smaller and grey below the main text. */
const twoLine = (main: string, secondary: string | null): CellInput =>
  secondary ? ({ content: `${main}\n${secondary}`, secondary } as CellInput) : main;

const secondaryOf = (raw: unknown) => {
  const v = raw && typeof raw === "object" ? (raw as { secondary?: unknown }).secondary : undefined;
  return typeof v === "string" ? v : null;
};

function classRow(r: ClassRow): RowInput {
  const rate = twoLine(
    money(r.rate),
    r.retention && r.baseRate !== null ? `-${percent(r.retention)} de ${money(r.baseRate)}` : null
  );
  return [
    dateLabel(r.date),
    twoLine(r.family, r.note || null),
    r.role ?? "-",
    scheduleLabel(r.start, r.end).replace("–", "-"),
    hoursLabel(r.hours),
    rate,
    money(r.amount),
    { content: r.status === "paid" ? "Pagado" : "Pendiente", styles: { textColor: r.status === "paid" ? GREEN : AMBER, fontStyle: "bold" } },
  ];
}

export function buildReport(data: ExportData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const rows = [...data.rows].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const t = totals(rows);

  /* Header */
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text("Registro de clases", M, 52);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
  doc.text(`Generado el ${dateLong(todayISO())}`, W - M, 52, { align: "right" });

  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
  doc.text(data.scope.title, M, 78);
  if (data.scope.details.length) {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text(data.scope.details.join("  ·  "), M, 92);
  }

  /* Summary tiles */
  const tiles: [string, string, [number, number, number]?][] = [
    ["Clases", String(t.count)],
    ["Horas", hoursLabel(t.hours)],
    ["Total", money(t.amount)],
    ["Pagado", money(t.paid), GREEN],
    ["Pendiente", money(t.pending), AMBER],
  ];
  const gap = 8;
  const tileW = (W - 2 * M - gap * (tiles.length - 1)) / tiles.length;
  const tileY = 106;
  tiles.forEach(([label, value, color], i) => {
    const x = M + i * (tileW + gap);
    doc.setDrawColor(...LINE).setFillColor(...SOFT);
    doc.roundedRect(x, tileY, tileW, 44, 4, 4, "FD");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 9, tileY + 15);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...(color ?? INK));
    doc.text(value, x + 9, tileY + 34);
  });

  /* Table body (grouped by month when the report spans several months) */
  const months = [...new Set(rows.map((r) => r.date.slice(0, 7)))];
  const grouped = months.length > 1;
  const body: RowInput[] = [];
  for (const m of months) {
    const inMonth = rows.filter((r) => r.date.startsWith(m));
    if (grouped) {
      body.push([
        { content: monthLabel(m), colSpan: 8, styles: { fontStyle: "bold", fillColor: [232, 232, 228], textColor: INK } },
      ]);
    }
    body.push(...inMonth.map(classRow));
    if (grouped) {
      const st = totals(inMonth);
      const subtotal: CellInput[] = [
        { content: `Subtotal ${monthLabel(m).toLowerCase()}`, colSpan: 4, styles: { fontStyle: "bold" } },
        { content: hoursLabel(st.hours), styles: { fontStyle: "bold", halign: "right" } },
        "",
        { content: money(st.amount), styles: { fontStyle: "bold", halign: "right" } },
        "",
      ];
      body.push(subtotal);
    }
  }

  autoTable(doc, {
    startY: tileY + 62,
    margin: { left: M, right: M, bottom: 50 },
    head: [["Fecha", "Familia / lugar", "Rol", "Horario", "Horas", "Tarifa", "Total", "Estado"]],
    body: body.length ? body : [[{ content: "No hay clases con estos filtros.", colSpan: 8, styles: { halign: "center", textColor: MUTED } }]],
    foot: [
      [
        { content: "Total", colSpan: 4 },
        { content: hoursLabel(t.hours), styles: { halign: "right" } },
        "",
        { content: money(t.amount), styles: { halign: "right" } },
        "",
      ],
    ],
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: INK,
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
      lineColor: LINE,
      valign: "top",
    },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: [232, 232, 228], textColor: INK, fontStyle: "bold" },
    bodyStyles: { lineWidth: { bottom: 0.5 } },
    columnStyles: {
      0: { cellWidth: 62 },
      2: { cellWidth: 52 },
      3: { cellWidth: 82 },
      4: { cellWidth: 38, halign: "right" },
      5: { cellWidth: 74, halign: "right" },
      6: { cellWidth: 58, halign: "right" },
      7: { cellWidth: 54 },
    },
    didParseCell: (hook) => {
      // Numeric column headers line up with their right-aligned values.
      if (hook.section === "head" && [4, 5, 6].includes(hook.column.index)) hook.cell.styles.halign = "right";
    },
    // Draw the `secondary` part of two-line cells smaller and grey (space is already reserved).
    willDrawCell: (hook) => {
      const sub = secondaryOf(hook.cell.raw);
      if (hook.section !== "body" || !sub) return;
      const width = hook.cell.width - hook.cell.padding("left") - hook.cell.padding("right");
      const subLines = doc.splitTextToSize(sub, width) as string[];
      const all = hook.cell.text;
      const main = all.slice(0, Math.max(1, all.length - subLines.length));
      (hook.cell as unknown as { _sub: string[]; _mainLines: number })._sub = all.slice(main.length);
      (hook.cell as unknown as { _mainLines: number })._mainLines = main.length;
      hook.cell.text = main;
    },
    didDrawCell: (hook) => {
      const cell = hook.cell as unknown as { _sub?: string[]; _mainLines?: number };
      if (!cell._sub?.length) return;
      const fontSize = hook.cell.styles.fontSize;
      const lineH = fontSize * doc.getLineHeightFactor();
      const right = hook.cell.styles.halign === "right";
      const x = right ? hook.cell.x + hook.cell.width - hook.cell.padding("right") : hook.cell.x + hook.cell.padding("left");
      const y = hook.cell.y + hook.cell.padding("top") + (cell._mainLines ?? 1) * lineH;
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
      doc.text(cell._sub, x, y, { align: right ? "right" : "left", baseline: "top" });
    },
  });

  /* Footer on every page */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text("Registro de clases", M, H - 24);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc;
}

export function reportFilename(data: ExportData) {
  const rows = data.rows;
  if (!rows.length) return "clases.pdf";
  const dates = rows.map((r) => r.date).sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first === last ? `clases_${first}.pdf` : `clases_${first}_a_${last}.pdf`;
}
