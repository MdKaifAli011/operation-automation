import { addMinutes } from "date-fns";
import { parseIstSlot } from "@/lib/meetLinks/window";
import { getDemoTeacherFeedbackAfterMinutes } from "@/lib/demoFeedback/config";

export type DemoRowLike = {
  status: string;
  isoDate: string;
  timeHmIST: string;
  teacherFeedbackSubmittedAt?: string | null;
};

export function getDemoStartDate(row: DemoRowLike): Date | null {
  return parseIstSlot(row.isoDate, row.timeHmIST);
}

/** When the feedback form can first be offered (demo start + delay). */
export function getTeacherFeedbackEligibleAt(row: DemoRowLike): Date | null {
  const start = getDemoStartDate(row);
  if (!start || Number.isNaN(start.getTime())) return null;
  return addMinutes(start, getDemoTeacherFeedbackAfterMinutes());
}

export function isTeacherFeedbackEligible(row: DemoRowLike, now = new Date()): boolean {
  if (row.status === "Cancelled") return false;
  if (row.teacherFeedbackSubmittedAt) return false;
  const at = getTeacherFeedbackEligibleAt(row);
  if (!at) return false;
  return now.getTime() >= at.getTime();
}
