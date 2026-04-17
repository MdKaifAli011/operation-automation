import { addMonths, addYears, format, parseISO } from "date-fns";

export const MAX_SCHEDULE_TEMPLATES = 200;
export const MAX_WEEKLY_SESSION_ROWS = 40;
export const MAX_MILESTONE_ROWS = 80;

export type ScheduleProgrammeDurationUnit = "years" | "hours";

export type ScheduleDateRule =
  | { kind: "offset_days"; days: number }
  | { kind: "month_year"; yearOffset: number; month: number }
  | { kind: "month_week"; yearOffset: number; month: number; weekLabel: string }
  | { kind: "exact_date"; yearOffset: number; month: number; day: number };

export type ScheduleTemplateWeeklySessionRow = {
  id: string;
  sessionLabel: string;
  day: string;
  timeIST: string;
  subject: string;
  sessionDuration: string;
  sortOrder: number;
};

export type ScheduleTemplateMilestoneRow = {
  id: string;
  milestone: string;
  description: string;
  dateRule: ScheduleDateRule;
  sortOrder: number;
};

export type ScheduleTemplateGuidelines = {
  generalGuidelines: string[];
  mockTestsRevision: string[];
};

export type ScheduleTemplateEntry = {
  id: string;
  examValue: string;
  programmeName: string;
  programmeDurationValue: number;
  programmeDurationUnit: ScheduleProgrammeDurationUnit;
  targetExamLabel: string;
  weeklySessionStructure: ScheduleTemplateWeeklySessionRow[];
  milestones: ScheduleTemplateMilestoneRow[];
  guidelines: ScheduleTemplateGuidelines;
  isActive: boolean;
  sortOrder: number;
};

function str(v: unknown, max = 160): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return fallback;
}

function normalizeDateRule(raw: unknown): ScheduleDateRule | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kind = str(o.kind, 32).toLowerCase();
  if (kind === "offset_days") {
    return { kind, days: Math.round(num(o.days, 0)) };
  }
  if (kind === "month_year") {
    const month = Math.max(1, Math.min(12, Math.round(num(o.month, 1))));
    return {
      kind,
      yearOffset: Math.round(num(o.yearOffset, 0)),
      month,
    };
  }
  if (kind === "month_week") {
    const month = Math.max(1, Math.min(12, Math.round(num(o.month, 1))));
    const weekLabel = str(o.weekLabel, 40) || "Week 1";
    return {
      kind,
      yearOffset: Math.round(num(o.yearOffset, 0)),
      month,
      weekLabel,
    };
  }
  if (kind === "exact_date") {
    const month = Math.max(1, Math.min(12, Math.round(num(o.month, 1))));
    const day = Math.max(1, Math.min(31, Math.round(num(o.day, 1))));
    return {
      kind,
      yearOffset: Math.round(num(o.yearOffset, 0)),
      month,
      day,
    };
  }
  return null;
}

function normalizeWeeklyRows(raw: unknown): ScheduleTemplateWeeklySessionRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduleTemplateWeeklySessionRow[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = str(o.id, 64);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      sessionLabel: str(o.sessionLabel, 80),
      day: str(o.day, 40),
      timeIST: str(o.timeIST, 64),
      subject: str(o.subject, 80),
      sessionDuration: str(o.sessionDuration, 64),
      sortOrder: Math.round(num(o.sortOrder, 0)),
    });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.sessionLabel.localeCompare(b.sessionLabel));
  return out.slice(0, MAX_WEEKLY_SESSION_ROWS);
}

function normalizeMilestones(raw: unknown): ScheduleTemplateMilestoneRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduleTemplateMilestoneRow[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = str(o.id, 64);
    if (!id || seen.has(id)) continue;
    const dateRule = normalizeDateRule(o.dateRule);
    if (!dateRule) continue;
    seen.add(id);
    out.push({
      id,
      milestone: str(o.milestone, 120),
      description: str(o.description, 280),
      dateRule,
      sortOrder: Math.round(num(o.sortOrder, 0)),
    });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.milestone.localeCompare(b.milestone));
  return out.slice(0, MAX_MILESTONE_ROWS);
}

function normalizeGuidelines(raw: unknown): ScheduleTemplateGuidelines {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const toLines = (x: unknown, maxLines: number) => {
    if (!Array.isArray(x)) return [];
    return x
      .map((line) => str(line, 300))
      .filter(Boolean)
      .slice(0, maxLines);
  };
  return {
    generalGuidelines: toLines(o.generalGuidelines, 40),
    mockTestsRevision: toLines(o.mockTestsRevision, 30),
  };
}

export function normalizeScheduleTemplateEntries(raw: unknown): ScheduleTemplateEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduleTemplateEntry[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id = str(o.id, 64);
    const examValue = str(o.examValue, 64);
    const programmeName = str(o.programmeName, 120);
    const targetExamLabel = str(o.targetExamLabel, 180);
    if (!id || seen.has(id) || !examValue || !programmeName || !targetExamLabel) continue;
    seen.add(id);
    const durationValue = Math.max(1, Math.min(999, Math.round(num(o.programmeDurationValue, 1))));
    const durationUnitRaw = str(o.programmeDurationUnit, 16).toLowerCase();
    const programmeDurationUnit: ScheduleProgrammeDurationUnit =
      durationUnitRaw === "hours" ? "hours" : "years";
    out.push({
      id,
      examValue,
      programmeName,
      programmeDurationValue: durationValue,
      programmeDurationUnit,
      targetExamLabel,
      weeklySessionStructure: normalizeWeeklyRows(o.weeklySessionStructure),
      milestones: normalizeMilestones(o.milestones),
      guidelines: normalizeGuidelines(o.guidelines),
      isActive: o.isActive !== false,
      sortOrder: Math.round(num(o.sortOrder, 0)),
    });
  }
  out.sort((a, b) => {
    const ex = a.examValue.localeCompare(b.examValue);
    return ex !== 0
      ? ex
      : a.sortOrder - b.sortOrder || a.programmeName.localeCompare(b.programmeName);
  });
  return out.slice(0, MAX_SCHEDULE_TEMPLATES);
}

function monthLabel(month: number): string {
  return format(new Date(2000, month - 1, 1), "MMMM");
}

export function resolveDateRuleLabel(
  commencementIsoDate: string,
  rule: ScheduleDateRule,
): string {
  const base = parseISO(`${commencementIsoDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return "—";
  if (rule.kind === "offset_days") {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + rule.days);
    return format(dt, "d MMMM yyyy");
  }
  if (rule.kind === "month_year") {
    const dt = addYears(new Date(Date.UTC(base.getUTCFullYear(), rule.month - 1, 1)), rule.yearOffset);
    return `${monthLabel(rule.month)} ${dt.getUTCFullYear()}`;
  }
  if (rule.kind === "month_week") {
    const dt = addYears(new Date(Date.UTC(base.getUTCFullYear(), rule.month - 1, 1)), rule.yearOffset);
    return `${format(dt, "MMM yyyy")} (${rule.weekLabel})`;
  }
  const monthStart = new Date(Date.UTC(base.getUTCFullYear(), rule.month - 1, 1));
  const dt = addYears(monthStart, rule.yearOffset);
  dt.setUTCDate(rule.day);
  return format(dt, "d MMMM yyyy");
}

export function formatProgrammeDuration(value: number, unit: ScheduleProgrammeDurationUnit): string {
  const n = Math.max(1, Math.round(value));
  if (unit === "hours") return `${n} ${n === 1 ? "Hour" : "Hours"}`;
  return `${n} ${n === 1 ? "Year" : "Years"}`;
}

export function buildDefaultScheduleTemplateRows(): ScheduleTemplateEntry[] {
  return normalizeScheduleTemplateEntries([
    {
      id: "default-jee-yearly",
      examValue: "JEE Main",
      programmeName: "JEE Training",
      programmeDurationValue: 1,
      programmeDurationUnit: "years",
      targetExamLabel: "JEE Main / Advanced 2027",
      sortOrder: 0,
      isActive: true,
      weeklySessionStructure: [
        {
          id: "weekly-1",
          sessionLabel: "Session 1",
          day: "Wednesday",
          timeIST: "6:30 AM – 8:00 AM",
          subject: "Chemistry",
          sessionDuration: "90 Minutes",
          sortOrder: 1,
        },
        {
          id: "weekly-2",
          sessionLabel: "Session 2",
          day: "Saturday",
          timeIST: "8:30 PM – 10:30 PM",
          subject: "Mathematics",
          sessionDuration: "90 Minutes",
          sortOrder: 2,
        },
        {
          id: "weekly-3",
          sessionLabel: "Session 3",
          day: "Sunday",
          timeIST: "8:30 PM – 10:30 PM",
          subject: "Physics",
          sessionDuration: "90 Minutes",
          sortOrder: 3,
        },
      ],
      milestones: [
        {
          id: "m-1",
          milestone: "Session Commencement",
          description: "Training begins — 1 Year programme kicks off",
          dateRule: { kind: "offset_days", days: 0 },
          sortOrder: 1,
        },
        {
          id: "m-2",
          milestone: "JEE Application Form",
          description: "Fill up application form for JEE 2027",
          dateRule: { kind: "month_year", yearOffset: 0, month: 11 },
          sortOrder: 2,
        },
        {
          id: "m-3",
          milestone: "JEE Main – 1st Attempt",
          description: "First attempt at JEE Main examination",
          dateRule: { kind: "month_week", yearOffset: 1, month: 1, weekLabel: "Week 1" },
          sortOrder: 3,
        },
        {
          id: "m-4",
          milestone: "JEE Main – 2nd Attempt",
          description: "Second attempt at JEE Main examination",
          dateRule: { kind: "month_week", yearOffset: 1, month: 4, weekLabel: "Week 1" },
          sortOrder: 4,
        },
        {
          id: "m-5",
          milestone: "JEE Advanced",
          description: "JEE Advanced examination",
          dateRule: { kind: "month_week", yearOffset: 1, month: 5, weekLabel: "Week 3" },
          sortOrder: 5,
        },
        {
          id: "m-6",
          milestone: "Equivalence Certificate",
          description: "Obtain Equivalence Certificate",
          dateRule: { kind: "month_year", yearOffset: 1, month: 6 },
          sortOrder: 6,
        },
        {
          id: "m-7",
          milestone: "DASA Application Opens",
          description: "DASA Application for admissions starts",
          dateRule: { kind: "exact_date", yearOffset: 1, month: 6, day: 1 },
          sortOrder: 7,
        },
      ],
      guidelines: {
        generalGuidelines: [
          "Attend all 3 sessions each week without fail — consistency is key to JEE success.",
          "Revise each session's content within 24 hours to reinforce retention.",
          "Solve a minimum of 20 practice problems per subject per week.",
          "Maintain a dedicated error log book to track and revisit mistakes.",
        ],
        mockTestsRevision: [
          "Monthly full-length mock tests to be conducted after Week 4, 8, 12, and so on.",
          "Dedicated revision weeks to be planned before JEE Main 1st Attempt (January 2027).",
          "Final sprint revision between JEE Main 2nd Attempt (April 2027) and JEE Advanced (May 2027).",
        ],
      },
    },
  ]);
}

export function parseCommencementIsoDate(raw: string): string {
  const t = str(raw, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return "";
  return t;
}

export function addYearsToIsoDate(isoDate: string, years: number): string {
  const d = parseISO(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  const next = addYears(d, Math.max(0, Math.round(years)));
  return format(next, "yyyy-MM-dd");
}

export function addMonthsToIsoDate(isoDate: string, months: number): string {
  const d = parseISO(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  const next = addMonths(d, Math.round(months));
  return format(next, "yyyy-MM-dd");
}
