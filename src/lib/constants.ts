import { DEFAULT_LEAD_SOURCE_OPTIONS } from "@/lib/leadSources";
import { FALLBACK_TARGET_EXAM_VALUES } from "@/lib/targetExams";

/**
 * Fallback when `/api/settings/target-exams` is unavailable.
 * Prefer loading exams from that API in UI.
 */
export const TARGET_EXAM_OPTIONS = [...FALLBACK_TARGET_EXAM_VALUES] as const;

/** @deprecated Use TARGET_EXAM_OPTIONS — kept for older screens. */
export const COURSE_OPTIONS = TARGET_EXAM_OPTIONS;

/** Default stored values for lead source — prefer loading from `/api/settings/lead-sources` in UI. */
export const DATA_TYPE_OPTIONS = DEFAULT_LEAD_SOURCE_OPTIONS.map(
  (o) => o.value,
) as readonly string[];

export const GRADE_OPTIONS = [
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
  "Dropper",
  "Graduate",
] as const;
