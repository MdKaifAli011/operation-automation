import { endOfDay, isAfter, parseISO } from "date-fns";
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

/**
 * New & Daily table: same as {@link isLeadInTodayData}, but rows with a **future**
 * follow-up date are excluded — those belong on the Follow-ups tab until the date
 * arrives (then they can appear here again if still on Today / new ongoing).
 */
export function isLeadInNewDailyView(lead: Lead): boolean {
  if (!isLeadInTodayData(lead)) return false;
  const raw = lead.followUpDate?.trim();
  if (!raw) return true;
  try {
    const d = parseISO(raw);
    if (Number.isNaN(d.getTime())) return true;
    return !isAfter(d, endOfDay(new Date()));
  } catch {
    return true;
  }
}

/** Ongoing Students tab: pipeline work — excludes untouched New intakes (see Today's Data). */
export function isLeadInOngoingPipeline(lead: Lead): boolean {
  return lead.sheetTab === "ongoing" && lead.rowTone !== "new";
}
