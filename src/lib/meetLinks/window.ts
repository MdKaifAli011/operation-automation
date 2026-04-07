import { addMinutes } from "date-fns";
import { getTeacherBlockDurationMinutes } from "@/lib/demoSchedule/durations";

/** IST wall-clock → instant (same rules as StudentDetailPage `parseIstSlot`). */
export function parseIstSlot(isoDate: string, hm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (h > 23 || m > 59 || Number.isNaN(h) || Number.isNaN(m)) return null;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:${mm}:00+05:30`);
}

export function getMeetHoldDurationMinutes(): number {
  const raw = process.env.MEET_HOLD_DURATION_MINUTES?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0 && n <= 24 * 60) return n;
  }
  return 300;
}

export function computeMeetWindow(
  isoDate: string,
  timeHmIST: string,
  durationMinutes?: number,
): { start: Date; end: Date } | null {
  const start = parseIstSlot(isoDate, timeHmIST);
  if (!start) return null;
  const dm = durationMinutes ?? getMeetHoldDurationMinutes();
  return { start, end: addMinutes(start, dm) };
}

/** Teacher is blocked for this interval from the IST start (default 2 hours). */
export function computeTeacherBlockWindow(
  isoDate: string,
  timeHmIST: string,
  durationMinutes?: number,
): { start: Date; end: Date } | null {
  const start = parseIstSlot(isoDate, timeHmIST);
  if (!start) return null;
  const dm = durationMinutes ?? getTeacherBlockDurationMinutes();
  return { start, end: addMinutes(start, dm) };
}
