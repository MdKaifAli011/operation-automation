import type { Lead } from "@/lib/types";

/**
 * Fresh intakes (status New) live on Today's Data until promoted (e.g. Interested → Ongoing).
 * Supports legacy rows that used `sheetTab: "ongoing"` + `rowTone: "new"`.
 */
export function isLeadInTodayData(lead: Lead): boolean {
  return (
    lead.sheetTab === "today" ||
    (lead.sheetTab === "ongoing" && lead.rowTone === "new")
  );
}

/** Ongoing Students tab: pipeline work — excludes untouched New intakes (see Today's Data). */
export function isLeadInOngoingPipeline(lead: Lead): boolean {
  return lead.sheetTab === "ongoing" && lead.rowTone !== "new";
}
