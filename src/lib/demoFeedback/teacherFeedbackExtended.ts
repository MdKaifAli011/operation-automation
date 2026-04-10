/** Shared labels & validation for extended teacher demo feedback (public form + API). */

export const EXAM_TRACK_OPTIONS = [
  { value: "neet", label: "NEET (PCB)" },
  { value: "jee_main", label: "JEE Main" },
  { value: "jee_adv", label: "JEE Advanced" },
  { value: "sat", label: "SAT" },
  { value: "ib", label: "IB DP / MYP" },
  { value: "cuet", label: "CUET" },
  { value: "boards_competitive", label: "Board exams + competitive mix" },
  { value: "other", label: "Other / multiple tracks" },
  { value: "manual_entry", label: "Other / not listed in our system" },
] as const;

export type ExamTrackValue = (typeof EXAM_TRACK_OPTIONS)[number]["value"];

export const PACE_OPTIONS = [
  { value: "too_fast", label: "Too fast — student looked rushed" },
  { value: "right", label: "About right for this level" },
  { value: "too_slow", label: "Too slow — could cover more" },
] as const;

export type PaceFitValue = (typeof PACE_OPTIONS)[number]["value"];

export const PARENT_INVOLVEMENT_OPTIONS = [
  { value: "high", label: "Very involved — asked questions, engaged" },
  { value: "moderate", label: "Somewhat involved — there, spoke a little" },
  { value: "low", label: "Little involvement — mostly quiet" },
  { value: "not_observed", label: "Parent not in this class / not sure" },
] as const;

export type ParentInvolvementValue =
  (typeof PARENT_INVOLVEMENT_OPTIONS)[number]["value"];

export const RECOMMENDED_NEXT_OPTIONS = [
  {
    value: "strong_continue",
    label: "Good fit — suggest joining / next steps with us",
  },
  {
    value: "needs_support",
    label: "Has potential — needs clear practice plan & follow-up",
  },
  {
    value: "more_evaluation",
    label: "Hard to say — needs another class or different subject",
  },
  {
    value: "parent_conversation",
    label: "Counsellor should talk to parents before deciding",
  },
  {
    value: "not_current_fit",
    label: "Not the right fit right now (level or expectations)",
  },
] as const;

export type RecommendedNextValue =
  (typeof RECOMMENDED_NEXT_OPTIONS)[number]["value"];

const EXAM_SET = new Set<string>(EXAM_TRACK_OPTIONS.map((o) => o.value));
const PACE_SET = new Set<string>(PACE_OPTIONS.map((o) => o.value));
const PARENT_SET = new Set<string>(PARENT_INVOLVEMENT_OPTIONS.map((o) => o.value));
const REC_SET = new Set<string>(RECOMMENDED_NEXT_OPTIONS.map((o) => o.value));

const RATING_DIM = new Set(["1", "2", "3", "4", "5"]);

export function parseScore(s: unknown): string | null {
  const t = typeof s === "string" ? s.trim() : "";
  if (!t) return null;
  return RATING_DIM.has(t) ? t : null;
}

export function inferExamTrackFromLead(args: {
  targetExams: string[];
  dataType: string;
}): ExamTrackValue | "" {
  const exams = args.targetExams.map((e) => e.toUpperCase());
  if (exams.some((x) => x.includes("NEET"))) return "neet";
  if (exams.some((x) => x.includes("JEE ADV") || x.includes("ADVANCED")))
    return "jee_adv";
  if (exams.some((x) => x.includes("JEE"))) return "jee_main";
  if (exams.some((x) => x.includes("SAT"))) return "sat";
  if (exams.some((x) => x.includes("IB"))) return "ib";
  if (exams.some((x) => x.includes("CUET"))) return "cuet";
  const dt = args.dataType.toLowerCase();
  if (dt.includes("manual")) return "manual_entry";
  return "";
}

export type ExtendedBody = {
  examTrack: string;
  sessionTopicsCovered: string;
  paceFit: string;
  ratingEngagement: string;
  ratingConceptual: string;
  ratingApplication: string;
  ratingExamReadiness: string;
  parentInvolvement: string;
  recommendedNext: string;
  followUpHomework: string;
};

export function parseExtendedBody(body: Record<string, unknown>): {
  ok: true;
  extended: ExtendedBody;
} | { ok: false; error: string } {
  const examTrack =
    typeof body.examTrack === "string" ? body.examTrack.trim() : "";
  if (!examTrack || !EXAM_SET.has(examTrack)) {
    return {
      ok: false,
      error:
        "Please choose which exam this student is mainly preparing for (dropdown in section 1).",
    };
  }

  const sessionTopicsCovered =
    typeof body.sessionTopicsCovered === "string"
      ? body.sessionTopicsCovered.trim()
      : "";
  if (sessionTopicsCovered.length < 3) {
    return {
      ok: false,
      error:
        "Please describe what you covered in this session (topics, question types, or skills).",
    };
  }
  if (sessionTopicsCovered.length > 4000) {
    return { ok: false, error: "Topics covered text is too long." };
  }

  const paceFit = typeof body.paceFit === "string" ? body.paceFit.trim() : "";
  if (!paceFit || !PACE_SET.has(paceFit)) {
    return { ok: false, error: "Please indicate whether the session pace was right." };
  }

  const re = parseScore(body.ratingEngagement);
  const rc = parseScore(body.ratingConceptual);
  const ra = parseScore(body.ratingApplication);
  const rr = parseScore(body.ratingExamReadiness);
  if (!re || !rc || !ra || !rr) {
    return {
      ok: false,
      error:
        "Please rate all four areas (engagement, concepts, application, exam readiness) from 1–5.",
    };
  }

  const parentInvolvement =
    typeof body.parentInvolvement === "string"
      ? body.parentInvolvement.trim()
      : "";
  if (!parentInvolvement || !PARENT_SET.has(parentInvolvement)) {
    return {
      ok: false,
      error: "Please select how involved the parent/guardian was (or N/A).",
    };
  }

  const recommendedNext =
    typeof body.recommendedNext === "string"
      ? body.recommendedNext.trim()
      : "";
  if (!recommendedNext || !REC_SET.has(recommendedNext)) {
    return {
      ok: false,
      error: "Please choose what you recommend as the next step for the team.",
    };
  }

  const followUpHomework =
    typeof body.followUpHomework === "string"
      ? body.followUpHomework.trim()
      : "";
  if (followUpHomework.length > 4000) {
    return { ok: false, error: "Follow-up / homework text is too long." };
  }

  return {
    ok: true,
    extended: {
      examTrack,
      sessionTopicsCovered,
      paceFit,
      ratingEngagement: re,
      ratingConceptual: rc,
      ratingApplication: ra,
      ratingExamReadiness: rr,
      parentInvolvement,
      recommendedNext,
      followUpHomework,
    },
  };
}

export function examTrackLabel(v: string): string {
  return EXAM_TRACK_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function recommendedNextLabel(v: string): string {
  return RECOMMENDED_NEXT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function paceFitLabel(v: string): string {
  return PACE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function parentInvolvementLabel(v: string): string {
  return PARENT_INVOLVEMENT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}
