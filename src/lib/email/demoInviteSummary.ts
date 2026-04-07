import { format, parseISO } from "date-fns";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";

/** IST wall-clock → instant (same rules as StudentDetailPage). */
function parseIstSlot(isoDate: string, hm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (h > 23 || m > 59 || Number.isNaN(h) || Number.isNaN(m)) return null;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:${mm}:00+05:30`);
}

function formatTime12hInZone(d: Date, timeZone: string): string {
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return s.replace(/\b(AM|PM)\b/g, (x) => x.toLowerCase());
}

/** One-line summary for a demo row (matches StudentDetailPage demoRowSummaryLine). */
export function demoInviteSummaryLine(r: DemoTableRowPersisted): string {
  const slot = parseIstSlot(r.isoDate, r.timeHmIST);
  const ist = slot
    ? `${format(parseISO(r.isoDate), "d MMM yyyy")} · ${formatTime12hInZone(slot, "Asia/Kolkata")} IST`
    : r.isoDate;
  return `${r.subject} · ${r.teacher} · ${ist}`;
}
