import { addDays } from "date-fns";
import { parseIstSlot } from "@/lib/meetLinks/window";

const IST = "Asia/Kolkata";

/** YYYY-MM-DD for the calendar day of `d` in `timeZone` (e.g. IST). */
function formatYmdInTimeZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

const PREFERRED_TIMES = ["10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

/**
 * Next IST wall-clock slot in the near future (common class times), at least ~`minuteBuffer` minutes ahead.
 */
export function suggestNextFutureIstSlot(
  now = new Date(),
  minuteBuffer = 3,
): { isoDate: string; timeHmIST: string } {
  const threshold = now.getTime() + minuteBuffer * 60_000;
  for (let day = 0; day < 45; day++) {
    const probe = addDays(now, day);
    const isoDate = formatYmdInTimeZone(probe, IST);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
    for (const timeHmIST of PREFERRED_TIMES) {
      const slot = parseIstSlot(isoDate, timeHmIST);
      if (slot && slot.getTime() > threshold) {
        return { isoDate, timeHmIST };
      }
    }
  }
  for (let bump = 45; bump < 120; bump++) {
    const probe = addDays(now, bump);
    const isoDate = formatYmdInTimeZone(probe, IST);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
    const slot = parseIstSlot(isoDate, "10:00");
    if (slot && slot.getTime() > threshold) return { isoDate, timeHmIST: "10:00" };
  }
  const last = formatYmdInTimeZone(addDays(now, 365), IST);
  return { isoDate: last || "2099-12-31", timeHmIST: "10:00" };
}
