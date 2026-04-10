import type { Lead } from "@/lib/types";

/** Full pipeline + converted sheet tab. */
export function isConvertedFullPipeline(lead: Lead): boolean {
  return lead.sheetTab === "converted" && lead.pipelineSteps === 4;
}

/**
 * Best-effort instant for “when conversion counts” for monthly stats:
 * schedule `completedAt` when set, otherwise Mongo `updatedAt` from the API.
 */
export function getLeadConversionReferenceIso(lead: Lead): string | undefined {
  const meta = lead.pipelineMeta;
  if (meta && typeof meta === "object" && meta !== null && "schedule" in meta) {
    const sch = (meta as { schedule?: { completedAt?: string | null } }).schedule;
    const ca = sch?.completedAt;
    if (typeof ca === "string" && ca.trim().length > 0) {
      const t = Date.parse(ca);
      if (!Number.isNaN(t)) return new Date(t).toISOString();
    }
  }
  return lead.updatedAt;
}

/** Calendar month of `now` (local) — matches how users read “this month”. */
export function isIsoInCurrentMonth(
  iso: string | undefined,
  now: Date = new Date(),
): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function isLeadConvertedInCurrentMonth(
  lead: Lead,
  now: Date = new Date(),
): boolean {
  if (!isConvertedFullPipeline(lead)) return false;
  return isIsoInCurrentMonth(getLeadConversionReferenceIso(lead), now);
}
