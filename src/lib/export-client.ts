"use client";

import { getExportData } from "@/app/actions";
import type { ActionResult, ExportFilter } from "@/lib/types";

/** Fetches the rows for a filter / selection and downloads the PDF (built in the browser). */
export async function downloadReport(filter: ExportFilter): Promise<ActionResult<{ count: number }>> {
  const res = await getExportData(filter);
  if (!res.ok) return res;
  if (!res.data.rows.length) return { ok: false, error: "No hay clases para exportar." };
  const { buildReport, reportFilename } = await import("@/lib/pdf-report");
  const doc = buildReport(res.data);
  doc.save(reportFilename(res.data));
  return { ok: true, count: res.data.rows.length };
}
