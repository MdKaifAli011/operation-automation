import { format, parseISO } from "date-fns";
import type {
  LeadPipelineMilestoneRow,
  LeadPipelineScheduleGuidelines,
  LeadPipelineScheduleProgrammeOverview,
  LeadPipelineWeeklySessionRow,
} from "@/lib/leadPipelineMetaTypes";
import {
  formatProgrammeDuration,
  parseCommencementIsoDate,
  resolveDateRuleLabel,
  type ScheduleTemplateEntry,
} from "@/lib/scheduleTemplateTypes";

function safeDateLabel(isoDate: string): string {
  const d = parseISO(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return format(d, "d MMMM yyyy");
}

export function selectDefaultScheduleTemplate(
  templates: ScheduleTemplateEntry[],
  leadTargetExams: string[] | undefined,
): ScheduleTemplateEntry | null {
  if (templates.length === 0) return null;
  const exams = Array.isArray(leadTargetExams)
    ? leadTargetExams.map((e) => String(e ?? "").trim()).filter(Boolean)
    : [];
  for (const ex of exams) {
    const hit = templates.find(
      (t) =>
        t.isActive !== false &&
        (t.examValue === ex || t.examValue.toLowerCase() === ex.toLowerCase()),
    );
    if (hit) return hit;
  }
  return templates.find((t) => t.isActive !== false) ?? templates[0] ?? null;
}

export function buildScheduleFromTemplate(opts: {
  template: ScheduleTemplateEntry;
  commencementIsoDate: string;
}): {
  programmeOverview: LeadPipelineScheduleProgrammeOverview;
  weeklySessionStructure: LeadPipelineWeeklySessionRow[];
  milestones: LeadPipelineMilestoneRow[];
  guidelines: LeadPipelineScheduleGuidelines;
} {
  const date = parseCommencementIsoDate(opts.commencementIsoDate);
  const startDateLabel = date ? safeDateLabel(date) : "";
  return {
    programmeOverview: {
      commencementIsoDate: date || null,
      programmeName: opts.template.programmeName,
      startDateLabel,
      durationLabel: formatProgrammeDuration(
        opts.template.programmeDurationValue,
        opts.template.programmeDurationUnit,
      ),
      targetExamLabel: opts.template.targetExamLabel,
    },
    weeklySessionStructure: opts.template.weeklySessionStructure.map((row, idx) => ({
      id: row.id,
      sessionLabel: row.sessionLabel,
      day: row.day,
      timeIST: row.timeIST,
      subject: row.subject,
      sessionDuration: row.sessionDuration,
      sortOrder: idx + 1,
    })),
    milestones: opts.template.milestones.map((row, idx) => ({
      id: row.id,
      targetDateLabel: date ? resolveDateRuleLabel(date, row.dateRule) : "",
      milestone: row.milestone,
      description: row.description,
      sortOrder: idx + 1,
    })),
    guidelines: {
      generalGuidelines: [...opts.template.guidelines.generalGuidelines],
      mockTestsRevision: [...opts.template.guidelines.mockTestsRevision],
    },
  };
}

