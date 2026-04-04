/** Target exams shown in leads grid (multi-select). */
export const TARGET_EXAM_OPTIONS = [
  "NEET",
  "JEE",
  "CUET",
  "SAT",
  "Other",
] as const;

/** @deprecated Use TARGET_EXAM_OPTIONS — kept for older screens. */
export const COURSE_OPTIONS = TARGET_EXAM_OPTIONS;

export const DATA_TYPE_OPTIONS = [
  "Organic",
  "Paid",
  "Referral",
  "Walk-in",
  "Partner",
] as const;

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
