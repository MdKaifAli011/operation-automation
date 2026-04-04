"use client";

import { addMonths, format, parseISO } from "date-fns";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { FACULTY_SEED, TARGET_EXAM_OPTIONS } from "@/lib/mock-data";
import { formatTargetExams } from "@/lib/lead-display";
import { formatLeadPhone } from "@/lib/phone-display";
import { extrasForLead } from "@/lib/student-detail";
import { SX } from "@/components/student/student-excel-ui";
import {
  IconBookMarked,
  IconCalendar,
  IconCalendarLarge,
  IconCheck,
  IconCloudUpload,
  IconGlobe,
  IconMail,
  IconPhone,
  IconPlus,
  IconSparkles,
} from "@/components/icons/CrmIcons";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: "step-1", n: 1, label: "Demo" },
  { id: "step-2", n: 2, label: "Brochure" },
  { id: "step-3", n: 3, label: "Fees" },
  { id: "step-4", n: 4, label: "Schedule" },
] as const;

const PIPELINE_TOTAL = STEPS.length;

type Props = { lead: Lead };

export function StudentDetailPage({ lead }: Props) {
  const extras = useMemo(() => extrasForLead(lead), [lead]);
  const completed = lead.pipelineSteps;
  const [activeStep, setActiveStep] = useState(() => {
    const c = lead.pipelineSteps;
    if (c >= PIPELINE_TOTAL) return PIPELINE_TOTAL;
    return Math.min(Math.max(c, 0) + 1, PIPELINE_TOTAL);
  });
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [scheduleView, setScheduleView] = useState<"table" | "calendar">(
    "table",
  );

  const badgeClass =
    lead.rowTone === "interested"
      ? "bg-[#e8f5e9] text-[#1b5e20] ring-1 ring-[#c8e6c9]"
      : lead.rowTone === "not_interested"
        ? "bg-[#ffebee] text-[#b71c1c] ring-1 ring-[#ffcdd2]"
        : lead.rowTone === "followup_later"
          ? "bg-[#fff8e1] text-[#e65100] ring-1 ring-[#ffe082]"
          : "bg-[#e3f2fd] text-[#0d47a1] ring-1 ring-[#bbdefb]";

  const sheetTabLabel =
    lead.sheetTab === "ongoing"
      ? "Ongoing"
      : lead.sheetTab === "followup"
        ? "Follow-up"
        : lead.sheetTab === "not_interested"
          ? "Not Interested"
          : "Converted";

  const pipeDone = Math.min(Math.max(completed, 0), PIPELINE_TOTAL);

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <header className={SX.studentHero}>
          <div className={SX.studentHeroTop}>
            <Link href="/" className={SX.studentHeroBack}>
              ← Back to Leads
            </Link>
            <span className="text-[#dadce0]" aria-hidden>
              |
            </span>
            <span className={SX.studentHeroMetaTop}>
              Lead workspace · <span className="tabular-nums">ID {lead.id}</span>
            </span>
          </div>

          <div className={SX.studentHeroBody}>
            <div className={SX.studentHeroTitleRow}>
              <h1 className={SX.studentHeroName}>{lead.studentName}</h1>
              <span
                className={cn(
                  "shrink-0 rounded-none px-3 py-1 text-[12px] font-bold uppercase tracking-wide",
                  badgeClass,
                )}
              >
                {extras.statusLabel}
              </span>
            </div>

            <div
              className={SX.studentHeroIconRow}
              role="group"
              aria-label="Primary contact details"
            >
              <span className={SX.studentHeroIconItem}>
                <IconPhone
                  className={cn(SX.studentHeroIcon, "text-[#ec407a]")}
                  aria-hidden
                />
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="font-medium tabular-nums text-[#202124] hover:underline"
                  >
                    {formatLeadPhone(lead)}
                  </a>
                ) : (
                  <span className="text-[#9aa0a6]">—</span>
                )}
              </span>
              <span className={SX.studentHeroIconItem}>
                <IconBookMarked
                  className={cn(SX.studentHeroIcon, "text-[#1565c0]")}
                  aria-hidden
                />
                <span className={SX.studentHeroCourseBadge}>
                  {formatTargetExams(lead.targetExams)}
                </span>
              </span>
              <span className={SX.studentHeroIconItem}>
                <IconGlobe
                  className={cn(SX.studentHeroIcon, "text-[#1565c0]")}
                  aria-hidden
                />
                <span className="font-medium text-[#202124]">
                  {extras.country}
                </span>
              </span>
              <span className={SX.studentHeroIconItem}>
                <IconCalendar
                  className={cn(SX.studentHeroIcon, "text-[#7e57c2]")}
                  aria-hidden
                />
                <span className="font-medium tabular-nums text-[#202124]">
                  {format(parseISO(lead.date), "dd/MM/yyyy")}
                </span>
              </span>
            </div>

            <p className={SX.studentHeroSubline}>
              <span className={SX.studentHeroSubLabel}>Parent</span>{" "}
              <span className={SX.studentHeroSubVal}>
                {lead.parentName || "—"}
              </span>
              <span className="mx-2 text-[#dadce0]" aria-hidden>
                ·
              </span>
              <span className={SX.studentHeroSubLabel}>Sheet</span>{" "}
              <span className={SX.studentHeroSubVal}>{sheetTabLabel}</span>
              <span className="mx-2 text-[#dadce0]" aria-hidden>
                ·
              </span>
              <span className={SX.studentHeroSubLabel}>Pipeline</span>{" "}
              <span className={SX.studentHeroSubVal}>
                {pipeDone}/{PIPELINE_TOTAL}
              </span>
              <span className="mx-2 text-[#dadce0]" aria-hidden>
                ·
              </span>
              <span className={SX.studentHeroSubLabel}>Email</span>{" "}
              <a
                href={`mailto:${extras.email}`}
                className="font-medium text-[#1565c0] hover:underline"
                title={extras.email}
              >
                {extras.email}
              </a>
            </p>
            {lead.followUpDate && (
              <p className="mt-2 text-[12px] font-medium text-[#e65100]">
                Next follow-up:{" "}
                {format(parseISO(lead.followUpDate), "dd MMM yyyy")}
              </p>
            )}
          </div>
        </header>

        <Stepper
          completed={completed}
          activeStep={activeStep}
          onStepSelect={setActiveStep}
        />

        <div className={SX.mainSplit}>
          <div className={SX.mainPane}>
            <div
              className="min-h-0 flex-1"
              role="tabpanel"
              id={`pipeline-panel-${activeStep}`}
              aria-labelledby={`pipeline-tab-${activeStep}`}
            >
              {activeStep === 1 && <DemoSection lead={lead} />}
              {activeStep === 2 && <BrochureSection />}
              {activeStep === 3 && <FeeSection lead={lead} />}
              {activeStep === 4 && (
                <ScheduleSection
                  view={scheduleView}
                  onViewChange={setScheduleView}
                />
              )}
            </div>
            <StepFooter activeStep={activeStep} onStepChange={setActiveStep} />
          </div>

          <aside className={SX.asidePane}>
            <p className={SX.asideIntro}>
              <span className="font-semibold text-slate-700">Workspace</span> — Notes,
              activity, and calls stay with this student across every step.
            </p>
            <div className={SX.sidePanel}>
              <div className={SX.sideHead}>Notes</div>
              <div className={SX.sideBody}>
                <textarea
                  rows={8}
                  className={cn(SX.textarea, "min-h-[140px] resize-y")}
                  placeholder="Type notes here — visible to your team in this session."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    setNotesSaved(true);
                    window.setTimeout(() => setNotesSaved(false), 2000);
                  }}
                />
                {notesSaved && (
                  <p className="mt-2 flex items-center gap-1 text-[12px] text-success">
                    <IconCheck className="h-3.5 w-3.5" /> Saved
                  </p>
                )}
              </div>
            </div>

            <div className={SX.sidePanel}>
              <div className={SX.sideHead}>Activity</div>
              <div className={SX.sideBody}>
                <table className={SX.dataTable}>
                  <thead>
                    <tr>
                      <th className={SX.dataTh}>Event</th>
                      <th className={SX.dataTh}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {
                        StepIcon: IconMail,
                        text: "Brochure sent (WhatsApp)",
                        time: "2h ago",
                      },
                      {
                        StepIcon: IconPhone,
                        text: "Call — Interested",
                        time: "1d ago",
                      },
                      {
                        StepIcon: IconCalendar,
                        text: "Demo scheduled · Biology",
                        time: "2d ago",
                      },
                      {
                        StepIcon: IconPlus,
                        text: "Lead created",
                        time: "3d ago",
                      },
                    ].map(({ StepIcon, text, time }, i) => (
                      <tr key={i}>
                        <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                          <span className="inline-flex items-start gap-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-none border border-slate-200 bg-white text-primary">
                              <StepIcon className="h-3 w-3" />
                            </span>
                            <span>{text}</span>
                          </span>
                        </td>
                        <td
                          className={cn(
                            SX.dataTdMuted,
                            i % 2 === 1 && SX.zebraRow,
                          )}
                        >
                          {time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={SX.sidePanel}>
              <div className={SX.sideHead}>Call history</div>
              <div className={SX.sideBody}>
                <table className={SX.dataTable}>
                  <thead>
                    <tr>
                      <th className={SX.dataTh}>Date</th>
                      <th className={SX.dataTh}>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={SX.dataTd}>02 Apr 2026</td>
                      <td className={SX.dataTd}>
                        <span className="rounded-none bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800">
                          Interested
                        </span>
                        <p className="mt-1 text-[12px] italic text-slate-500">
                          Discussed fee plan.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td className={cn(SX.dataTd, SX.zebraRow)}>28 Mar 2026</td>
                      <td className={cn(SX.dataTd, SX.zebraRow)}>
                        <span className="rounded-none bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                          No answer
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <button
                  type="button"
                  className={cn(
                    SX.btnGhost,
                    "mt-3 w-full justify-center rounded-none border border-dashed border-slate-300 py-2.5 text-slate-700",
                  )}
                  onClick={() => setCallOpen((v) => !v)}
                >
                  + Log call
                </button>
                {callOpen && (
                  <form
                    className="mt-3 space-y-2 rounded-none border border-slate-200 bg-slate-50/80 p-3 text-[13px]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setCallOpen(false);
                    }}
                  >
                    <input type="date" className={SX.input} />
                    <input placeholder="Duration" className={SX.input} />
                    <select className={cn(SX.select, "w-full")}>
                      <option>Interested</option>
                      <option>No Answer</option>
                      <option>Callback</option>
                      <option>Not Interested</option>
                    </select>
                    <input placeholder="Notes" className={SX.input} />
                    <button type="submit" className={cn(SX.btnPrimary, "w-full")}>
                      Save call
                    </button>
                  </form>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  completed,
  activeStep,
  onStepSelect,
}: {
  completed: number;
  activeStep: number;
  onStepSelect: (step: number) => void;
}) {
  const doneCount = Math.min(Math.max(completed, 0), PIPELINE_TOTAL);
  const pct = (doneCount / PIPELINE_TOTAL) * 100;
  const activeLabel =
    STEPS.find((s) => s.n === activeStep)?.label ?? "—";

  return (
    <div className="border-b border-[#d0d0d0] bg-white">
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div
          className="flex min-w-0 flex-1 items-stretch gap-px overflow-x-auto border border-slate-200 bg-slate-200 [scrollbar-width:thin]"
          role="tablist"
          aria-label={`Pipeline: ${doneCount} of ${PIPELINE_TOTAL} done. Open step below.`}
        >
          {STEPS.map((s) => {
            const isDone = completed >= s.n;
            const isActive = activeStep === s.n;
            return (
              <button
                key={s.id}
                type="button"
                id={`pipeline-tab-${s.n}`}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                title={
                  isDone
                    ? `${s.label} — completed`
                    : isActive
                      ? `${s.label} — open (in progress)`
                      : `${s.label} — not started`
                }
                onClick={() => onStepSelect(s.n)}
                className={cn(
                  "flex min-w-[4.25rem] flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-left transition-colors sm:min-w-0 sm:px-2.5",
                  isActive &&
                    "bg-white font-semibold text-primary ring-2 ring-inset ring-primary/35",
                  !isActive &&
                    isDone &&
                    "bg-emerald-50/90 text-emerald-900 hover:bg-emerald-100/90",
                  !isActive &&
                    !isDone &&
                    "bg-slate-50 text-slate-600 hover:bg-slate-100",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-bold tabular-nums leading-none",
                    isDone &&
                      "border-emerald-600 bg-emerald-600 text-white",
                    !isDone &&
                      isActive &&
                      "border-primary bg-primary text-white",
                    !isDone &&
                      !isActive &&
                      "border-slate-300 bg-white text-slate-500",
                  )}
                  aria-hidden
                >
                  {isDone ? (
                    <IconCheck className="h-3 w-3" />
                  ) : (
                    s.n
                  )}
                </span>
                <span className="min-w-0 truncate text-[11px] sm:text-[12px]">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:border-l sm:border-slate-200 sm:pl-3 sm:pt-0"
          title={`${doneCount} of ${PIPELINE_TOTAL} onboarding steps completed`}
        >
          <p className="min-w-0 text-[11px] leading-tight text-slate-600 sm:text-right">
            <span className="sr-only">Currently viewing: </span>
            <span className="font-semibold text-slate-800">{activeLabel}</span>
            <span className="text-slate-400" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <span className="tabular-nums text-slate-600">
              <strong className="text-slate-900">{doneCount}</strong>/
              {PIPELINE_TOTAL}
            </span>
          </p>
          <div
            className="relative h-1.5 w-full min-w-[5rem] max-w-[140px] overflow-hidden border border-slate-200 bg-slate-100 sm:max-w-[160px]"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={PIPELINE_TOTAL}
            aria-label={`${doneCount} of ${PIPELINE_TOTAL} steps completed`}
          >
            <div
              className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepFooter({
  activeStep,
  onStepChange,
}: {
  activeStep: number;
  onStepChange: (n: number) => void;
}) {
  const label = STEPS.find((s) => s.n === activeStep)?.label ?? "";
  return (
    <div className={SX.footerBar}>
      <button
        type="button"
        disabled={activeStep <= 1}
        onClick={() => onStepChange(activeStep - 1)}
        className={cn(
          SX.btnSecondary,
          "justify-self-start disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        ← Previous
      </button>
      <span className="max-w-[min(100%,200px)] truncate text-center text-[11px] text-[#78909c]">
        Step {activeStep}/{PIPELINE_TOTAL} · {label}
      </span>
      <button
        type="button"
        disabled={activeStep >= PIPELINE_TOTAL}
        onClick={() => onStepChange(activeStep + 1)}
        className={cn(
          SX.btnPrimary,
          "justify-self-end disabled:cursor-not-allowed disabled:opacity-40",
        )}
      >
        Next →
      </button>
    </div>
  );
}

function DemoSection({ lead }: { lead: Lead }) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<
    { subject: string; teacher: string; date: string; time: string; status: string }[]
  >([]);
  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div>
          <h2 className={SX.sectionTitle}>Step 1 · Demo classes</h2>
          <p className="mt-0.5 max-w-[520px] text-[11px] font-normal leading-snug text-[#757575]">
            Schedule trials by subject. Rows behave like a worksheet — add as many
            as you need.
          </p>
        </div>
      </div>
      <div className={SX.sectionBody}>
      {rows.length === 0 && !expanded ? (
        <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-[#b0bec5] bg-[#fafbfc] px-4 py-8 text-center">
          <IconCalendarLarge />
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-[#37474f]">
              No demo scheduled yet
            </p>
            <p className="mx-auto max-w-[300px] text-[12px] leading-relaxed text-[#78909c]">
              Use Create demo to add date, time, and teacher. Everything stays in
              the table below.
            </p>
          </div>
          <button
            type="button"
            className={cn(
              SX.btnSecondary,
              "border-[#1565c0] text-[#1565c0] hover:bg-[#e3f2fd]",
            )}
            onClick={() => setExpanded(true)}
          >
            + Create demo
          </button>
        </div>
      ) : rows.length === 0 && expanded ? (
        <DemoForm
          lead={lead}
          onCancel={() => setExpanded(false)}
          onSchedule={(r) => {
            setRows([r]);
            setExpanded(false);
          }}
        />
      ) : (
        <div className="overflow-auto">
          <table className={cn(SX.dataTable, "min-w-[640px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>#</th>
                <th className={SX.dataTh}>Subject</th>
                <th className={SX.dataTh}>Teacher</th>
                <th className={SX.dataTh}>Date</th>
                <th className={SX.dataTh}>Time (IST)</th>
                <th className={SX.dataTh}>Local</th>
                <th className={SX.dataTh}>Status</th>
                <th className={SX.dataTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="min-h-[40px]">
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>{i + 1}</td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>{r.subject}</td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>{r.teacher}</td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>{r.date}</td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>{r.time}</td>
                  <td className={cn(SX.dataTdMuted, i % 2 === 1 && SX.zebraRow)}>
                    12:30 PM SGT
                  </td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                    <select className={cn(SX.select, "w-full min-w-[100px] text-[12px]")}>
                      <option>Scheduled</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow, "text-[#1565c0]")}>
                    Edit · Delete ·{" "}
                    <button type="button" className="rounded-none bg-[#e3f2fd] px-2 py-0.5 text-[12px] font-medium">
                      Send link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className={cn(SX.btnGhost, "mt-3")}
            onClick={() => setExpanded(true)}
          >
            + Add another demo
          </button>
          <p className="mt-2 text-[12px] text-[#757575]">
            Students can schedule multiple demos across different subjects.
          </p>
          {expanded && (
            <DemoForm
              lead={lead}
              onCancel={() => setExpanded(false)}
              onSchedule={(r) => {
                setRows((prev) => [...prev, r]);
                setExpanded(false);
              }}
            />
          )}
        </div>
      )}
      </div>
    </section>
  );
}

function DemoForm({
  lead,
  onCancel,
  onSchedule,
}: {
  lead: Lead;
  onCancel: () => void;
  onSchedule: (r: {
    subject: string;
    teacher: string;
    date: string;
    time: string;
    status: string;
  }) => void;
}) {
  const demoTargetOptions =
    lead.targetExams.length > 0 ? lead.targetExams : [...TARGET_EXAM_OPTIONS];
  const [course, setCourse] = useState(
    () => demoTargetOptions[0] ?? TARGET_EXAM_OPTIONS[0],
  );
  const subs =
    course === "NEET"
      ? ["Biology", "Physics", "Chemistry"]
      : course === "JEE"
        ? ["Physics", "Chemistry", "Mathematics"]
        : ["English", "GK", "Reasoning"];
  const [subj, setSubj] = useState(subs[0]);
  const defaultTeacher =
    subj === "Biology"
      ? "Dr. Meena Singh"
      : subj === "Physics"
        ? "Mr. Ravi Kumar"
        : FACULTY_SEED[0].name;
  const [teacher, setTeacher] = useState(defaultTeacher);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [demoDate, setDemoDate] = useState(todayStr);
  const [demoTime, setDemoTime] = useState("10:00");
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  /** If the tab crosses midnight, raw `demoDate` can lag; never schedule or show a past calendar day. */
  const effectiveDemoDate = demoDate < todayStr ? todayStr : demoDate;

  const pickSubject = (s: string) => {
    setSubj(s);
    const t =
      s === "Biology"
        ? "Dr. Meena Singh"
        : s === "Physics"
          ? "Mr. Ravi Kumar"
          : FACULTY_SEED[0].name;
    setTeacher(t);
  };

  return (
    <div
      className="rounded-none border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04] sm:p-5"
      role="form"
      aria-label="Schedule demo class"
    >
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-[15px] font-bold text-slate-900">Schedule a trial class</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          Pick course, subject, and faculty — then set date and time in{" "}
          <strong className="font-semibold text-slate-700">IST</strong>. We show a
          local-time hint from the student&apos;s country.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span className="font-medium text-slate-700">Target exam</span>
          <span className="mb-1 mt-0.5 block text-[11px] text-slate-500">
            Programme for this trial
          </span>
          <select
            className={cn(SX.select, "mt-1 w-full")}
            value={course}
            onChange={(e) => {
              const v = e.target.value;
              setCourse(v);
              const next =
                v === "NEET"
                  ? "Biology"
                  : v === "JEE"
                    ? "Physics"
                    : "English";
              pickSubject(next);
            }}
          >
            {demoTargetOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[13px]">
          <span className="font-medium text-slate-700">Assigned teacher</span>
          <span className="mb-1 mt-0.5 block text-[11px] text-slate-500">
            Suggested from subject; you can override
          </span>
          <select
            className={cn(SX.select, "mt-1 w-full")}
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
          >
            <option value={defaultTeacher}>{defaultTeacher}</option>
            {FACULTY_SEED.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[13px] font-medium text-slate-700">Subject</legend>
        <p className="mb-2 text-[11px] text-slate-500">
          One subject per trial row — add another demo later for more subjects.
        </p>
        <div className="flex flex-wrap gap-2">
          {subs.map((s) => (
            <label
              key={s}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-none border px-3 py-2 text-[13px] transition-colors",
                subj === s
                  ? "border-primary bg-sky-50 font-medium text-primary ring-1 ring-primary/20"
                  : "border-slate-200 bg-slate-50/80 text-slate-700 hover:border-slate-300",
              )}
            >
              <input
                type="radio"
                name="demo-subj"
                className="sr-only"
                checked={subj === s}
                onChange={() => pickSubject(s)}
              />
              {s}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span className="font-medium text-slate-700">Demo date</span>
          <span className="mb-1 mt-0.5 block text-[11px] text-slate-500">
            Today or a future date — demos can&apos;t be scheduled in the past
          </span>
          <input
            type="date"
            min={todayStr}
            value={effectiveDemoDate}
            onChange={(e) => {
              setScheduleError(null);
              const v = e.target.value;
              if (v >= todayStr) setDemoDate(v);
            }}
            className={cn(SX.input, "mt-1 w-full")}
            aria-invalid={!!scheduleError}
          />
        </label>
        <label className="block text-[13px]">
          <span className="font-medium text-slate-700">Start time (IST)</span>
          <span className="mb-1 mt-0.5 block text-[11px] text-slate-500">
            India Standard Time
          </span>
          <input
            type="time"
            value={demoTime}
            onChange={(e) => {
              setScheduleError(null);
              setDemoTime(e.target.value);
            }}
            className={cn(SX.input, "mt-1 w-full")}
          />
          {effectiveDemoDate === todayStr && (
            <span className="mt-1 block text-[11px] text-amber-800/90">
              If today is selected, pick a time that hasn&apos;t passed yet (IST workflow).
            </span>
          )}
        </label>
      </div>

      {scheduleError && (
        <p
          className="mt-3 rounded-none border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800"
          role="alert"
        >
          {scheduleError}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" className={SX.btnSecondary} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center rounded-none border border-success bg-success px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#27692a]",
          )}
          onClick={() => {
            setScheduleError(null);
            const slot = new Date(`${effectiveDemoDate}T${demoTime}:00`);
            const now = new Date();
            if (slot.getTime() < now.getTime()) {
              setScheduleError(
                "That slot is already in the past. Pick a later time or a future date.",
              );
              return;
            }
            onSchedule({
              subject: subj,
              teacher,
              date: format(parseISO(effectiveDemoDate), "dd/MM/yyyy"),
              time: demoTime.includes(":")
                ? `${demoTime} IST`
                : demoTime,
              status: "Scheduled",
            });
          }}
        >
          Schedule demo
        </button>
      </div>
    </div>
  );
}

function BrochureSection() {
  const [file, setFile] = useState<File | null>(null);
  const [genPreview, setGenPreview] = useState(false);
  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div>
          <h2 className={SX.sectionTitle}>Step 2 · Course brochure</h2>
          <p className="mt-0.5 max-w-[520px] text-[11px] text-[#757575]">
            Upload or generate a PDF, then send to the student from here.
          </p>
        </div>
      </div>
      <div className={SX.sectionBody}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="flex h-[180px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-[#d0d0d0] bg-[#fafafa] px-4 text-center text-[13px] text-[#616161]">
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <IconCloudUpload />
            <span>Upload PDF or image</span>
            <span className="text-[12px] text-[#9e9e9e]">PDF, JPG, PNG</span>
          </label>
          {file && (
            <p className="mt-2 text-[13px]">
              {file.name} ({Math.round(file.size / 1024)} KB) ·{" "}
              <button type="button" className="text-[#1565c0] underline">
                Preview
              </button>{" "}
              ·{" "}
              <button type="button" className="text-[#c62828] underline" onClick={() => setFile(null)}>
                Remove
              </button>
            </p>
          )}
        </div>
        <div>
          <label className="text-[13px] font-semibold text-[#212121]">Generate from performance notes</label>
          <textarea
            rows={4}
            className={cn(SX.textarea, "mt-2")}
            placeholder="Demo performance notes, strengths, areas to improve…"
          />
          <button
            type="button"
            className={cn(SX.btnPrimary, "mt-2 gap-2")}
            onClick={() => {
              window.setTimeout(() => setGenPreview(true), 400);
            }}
          >
            <IconSparkles className="h-4 w-4 text-white" />
            Generate brochure
          </button>
          {genPreview && (
            <p className="mt-2 text-[13px] text-[#2e7d32]">Preview ready</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e8e8e8] pt-4">
        <button type="button" className="rounded-none bg-[#25d366] px-4 py-2 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#1fb855]">
          Send via WhatsApp
        </button>
        <button type="button" className={SX.btnPrimary}>
          Send via email
        </button>
      </div>
      </div>
    </section>
  );
}

const INSTALLMENT_COUNT_OPTIONS = [2, 3, 4, 5, 6] as const;

function splitFeeEvenly(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const out = Array.from({ length: n }, () => base);
  let rem = total - base * n;
  for (let i = 0; i < n && rem > 0; i++) {
    out[i] += 1;
    rem -= 1;
  }
  return out;
}

function padInstallmentDates(prev: string[], n: number): string[] {
  const out = prev.slice(0, n);
  while (out.length < n) {
    if (out.length === 0) {
      out.push(format(new Date(), "yyyy-MM-dd"));
      continue;
    }
    const anchor = parseISO(out[out.length - 1]!);
    out.push(format(addMonths(anchor, 1), "yyyy-MM-dd"));
  }
  return out;
}

/** After editing one installment, split the remainder across the others (whole rupees). */
function redistributeAfterAmountEdit(
  finalFee: number,
  amounts: number[],
  editedIndex: number,
  newAmount: number,
): number[] {
  const n = amounts.length;
  if (n <= 0) return [];
  const raw = Number.isFinite(newAmount) ? Math.round(newAmount) : 0;
  const clamped = Math.max(0, Math.min(raw, finalFee));
  const next = [...amounts];
  next[editedIndex] = clamped;
  const rest = finalFee - clamped;
  const others = Array.from({ length: n }, (_, i) => i).filter((i) => i !== editedIndex);
  if (others.length === 0) return next;
  const base = Math.floor(rest / others.length);
  let leftover = rest - base * others.length;
  for (const idx of others) {
    next[idx] = base + (leftover > 0 ? 1 : 0);
    if (leftover > 0) leftover -= 1;
  }
  return next;
}

function FeeSection({ lead }: { lead: Lead }) {
  const [scholarshipPct, setScholarshipPct] = useState(0);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] =
    useState<(typeof INSTALLMENT_COUNT_OPTIONS)[number]>(2);
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>([]);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);

  const total = 85000;
  const finalFee = useMemo(
    () => Math.round(total * (1 - scholarshipPct / 100)),
    [total, scholarshipPct],
  );

  const [currency, setCurrency] = useState("INR");
  const rates: Record<string, number> = {
    INR: 1,
    USD: 0.012,
    AED: 0.044,
    GBP: 0.0095,
    EUR: 0.011,
    SGD: 0.016,
  };
  const converted = finalFee * (rates[currency] ?? 1);

  const installmentSum = useMemo(
    () => installmentAmounts.reduce((a, b) => a + b, 0),
    [installmentAmounts],
  );

  const enableInstallments = () => {
    setInstallmentEnabled(true);
    const n = installmentCount;
    setInstallmentDates(padInstallmentDates([], n));
    setInstallmentAmounts(splitFeeEvenly(finalFee, n));
  };

  const onInstallmentCountChange = (n: (typeof INSTALLMENT_COUNT_OPTIONS)[number]) => {
    setInstallmentCount(n);
    setInstallmentDates((d) => padInstallmentDates(d, n));
    setInstallmentAmounts(splitFeeEvenly(finalFee, n));
  };

  const onScholarshipChange = (pct: number) => {
    const v = Math.max(0, Math.min(100, pct));
    setScholarshipPct(v);
    const nextFinal = Math.round(total * (1 - v / 100));
    if (installmentEnabled) {
      setInstallmentAmounts(splitFeeEvenly(nextFinal, installmentCount));
    }
  };

  const onInstallmentAmountChange = (index: number, value: string) => {
    const num = Number(value.replace(/,/g, ""));
    setInstallmentAmounts((prev) =>
      redistributeAfterAmountEdit(finalFee, prev, index, num),
    );
  };

  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div className="min-w-0 flex-1">
          <h2 className={SX.sectionTitle}>Step 3 · Fee structure</h2>
          <p className="mt-0.5 max-w-[520px] text-[11px] text-[#757575]">
            Scholarship and payment split for this student.
          </p>
        </div>
        {!installmentEnabled && (
          <button
            type="button"
            className={cn(
              SX.btnSecondary,
              "shrink-0 text-[13px] font-medium text-primary ring-1 ring-primary/25",
            )}
            title="Split the final fee into dated payments"
            onClick={enableInstallments}
          >
            Set up installment plan
          </button>
        )}
      </div>
      <div className={SX.sectionBody}>
        <div className="overflow-auto rounded-none border border-[#d0d0d0] bg-white">
          <table className={cn(SX.dataTable, "min-w-[520px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>Target (exams)</th>
                <th className={SX.dataTh}>Total fee</th>
                <th className={SX.dataTh}>Scholarship (%)</th>
                <th className={SX.dataTh}>Final fee</th>
                <th className={SX.dataTh}>Installment</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={SX.dataTd}>{formatTargetExams(lead.targetExams)}</td>
                <td className={SX.dataTd}>₹85,000</td>
                <td className={SX.dataTd}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={cn(SX.input, "w-20")}
                    value={scholarshipPct}
                    onChange={(e) =>
                      onScholarshipChange(Number(e.target.value) || 0)
                    }
                    aria-label="Scholarship percent"
                  />
                </td>
                <td className={cn(SX.dataTd, "font-semibold tabular-nums")}>
                  ₹{finalFee.toLocaleString("en-IN")}
                </td>
                <td className={SX.dataTd}>
                  {installmentEnabled ? (
                    <select
                      className={cn(SX.select, "w-full min-w-[100px]")}
                      value={installmentCount}
                      onChange={(e) =>
                        onInstallmentCountChange(
                          Number(e.target.value) as (typeof INSTALLMENT_COUNT_OPTIONS)[number],
                        )
                      }
                      aria-label="Number of installments"
                    >
                      {INSTALLMENT_COUNT_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c} payments
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[13px] text-[#9e9e9e]">—</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {installmentEnabled && (
          <div className="mt-3 overflow-hidden border border-[#d0d0d0] bg-white">
            <div className={SX.sectionHead}>
              <h3 className={SX.sectionTitle}>Installments</h3>
              <button
                type="button"
                className={SX.btnGhost}
                onClick={() => {
                  setInstallmentEnabled(false);
                  setInstallmentAmounts([]);
                  setInstallmentDates([]);
                }}
              >
                Remove plan
              </button>
            </div>
            <div className="overflow-x-auto border-t border-[#d0d0d0]">
              <table className={cn(SX.dataTable, "min-w-[360px]")}>
                <thead>
                  <tr>
                    <th className={SX.dataTh}>#</th>
                    <th className={SX.dataTh}>Due date</th>
                    <th className={SX.dataTh}>Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {installmentAmounts.map((amt, i) => (
                    <tr key={i}>
                      <td className={cn(SX.dataTd, "tabular-nums text-[#757575]")}>
                        {i + 1}
                      </td>
                      <td className={SX.dataTd}>
                        <input
                          type="date"
                          className={cn(SX.input, "min-w-[140px] max-w-[180px]")}
                          value={installmentDates[i] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setInstallmentDates((d) => {
                              const next = [...d];
                              next[i] = v;
                              return next;
                            });
                          }}
                          aria-label={`Payment ${i + 1} due date`}
                        />
                      </td>
                      <td className={SX.dataTd}>
                        <input
                          type="number"
                          min={0}
                          className={cn(SX.input, "min-w-[100px] max-w-[160px] tabular-nums")}
                          value={amt}
                          onChange={(e) =>
                            onInstallmentAmountChange(i, e.target.value)
                          }
                          aria-label={`Payment ${i + 1} amount in rupees`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#f5f7fa]">
                    <td
                      colSpan={2}
                      className={cn(SX.dataTd, "font-semibold text-[#424242]")}
                    >
                      Total
                    </td>
                    <td
                      className={cn(
                        SX.dataTd,
                        "font-semibold tabular-nums text-[#212121]",
                      )}
                    >
                      ₹{installmentSum.toLocaleString("en-IN")}
                      {installmentSum !== finalFee && (
                        <span className="ml-2 text-[11px] font-normal text-[#e65100]">
                          (should be ₹{finalFee.toLocaleString("en-IN")})
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="mt-3 overflow-hidden border border-[#d0d0d0] bg-white">
          <div className={SX.sectionHead}>
            <h3 className={SX.sectionTitle}>Currency</h3>
          </div>
          <div className="overflow-x-auto border-t border-[#d0d0d0]">
            <table className={cn(SX.dataTable, "w-full min-w-[480px] table-fixed")}>
              <colgroup>
                <col style={{ width: 140 }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <th scope="row" className={cn(SX.dataTh, "align-middle")}>
                    Currency
                  </th>
                  <td className={cn(SX.dataTd, "align-middle")}>
                    <select
                      className={cn(SX.select, "box-border w-[220px] max-w-full")}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      aria-label="Fee display currency"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="AED">AED</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="SGD">SGD</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <th scope="row" className={cn(SX.dataTh, "align-middle")}>
                    Shown as
                  </th>
                  <td className={cn(SX.dataTd, "align-middle")}>
                    <div
                      className="min-h-[1.5rem] whitespace-nowrap font-semibold tabular-nums text-[#212121]"
                      aria-live="polite"
                    >
                      {currency === "INR" ? (
                        `₹${finalFee.toLocaleString("en-IN")}`
                      ) : (
                        <>
                          ₹{finalFee.toLocaleString("en-IN")}
                          <span className="mx-1.5 font-normal text-[#9e9e9e]">
                            ≈
                          </span>
                          {converted.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          {currency}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-[#d0d0d0] bg-[#fafafa] px-2 py-1.5 text-[10px] leading-snug text-[#757575]">
            Non-INR amounts use approximate rates — always confirm before payment.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#d0d0d0] pt-3">
          <span className="mr-1 text-[13px] font-semibold text-[#424242]">
            Send fee structure
          </span>
          <button
            type="button"
            className="rounded-none bg-[#25d366] px-3 py-2 text-[13px] font-medium text-white shadow-sm hover:bg-[#1fb855]"
          >
            WhatsApp
          </button>
          <button type="button" className={SX.btnPrimary}>
            Email
          </button>
          <button
            type="button"
            className={cn(
              SX.btnSecondary,
              "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
            )}
          >
            Send enrollment form
          </button>
        </div>
      </div>
    </section>
  );
}

function ScheduleSection({
  view,
  onViewChange,
}: {
  view: "table" | "calendar";
  onViewChange: (v: "table" | "calendar") => void;
}) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div className="min-w-0 flex-1">
          <h2 className={SX.sectionTitle}>Step 4 · Class schedule</h2>
          <p className="mt-0.5 max-w-[480px] text-[11px] text-[#757575]">
            Switch table vs week view. Confirmed classes appear in both.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-none border border-[#d0d0d0] bg-white p-px text-[13px]">
          <button
            type="button"
            className={cn(
              "rounded-none px-3 py-1 font-medium",
              view === "table"
                ? "bg-[#1565c0] text-white"
                : "text-[#616161] hover:bg-[#f5f5f5]",
            )}
            onClick={() => onViewChange("table")}
          >
            Table
          </button>
          <button
            type="button"
            className={cn(
              "rounded-none px-3 py-1 font-medium",
              view === "calendar"
                ? "bg-[#1565c0] text-white"
                : "text-[#616161] hover:bg-[#f5f5f5]",
            )}
            onClick={() => onViewChange("calendar")}
          >
            Calendar
          </button>
        </div>
      </div>
      <div className={SX.sectionBody}>
      {view === "table" ? (
        <div className="overflow-auto">
          <table className={cn(SX.dataTable, "min-w-[720px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>Day</th>
                <th className={SX.dataTh}>Subject</th>
                <th className={SX.dataTh}>Time (IST)</th>
                <th className={SX.dataTh}>Local</th>
                <th className={SX.dataTh}>Teacher</th>
                <th className={SX.dataTh}>Duration</th>
                <th className={SX.dataTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={SX.dataTd}>Monday</td>
                <td className={SX.dataTd}>Biology</td>
                <td className={SX.dataTd}>9:00 AM</td>
                <td className={SX.dataTdMuted}>11:30 AM SGT</td>
                <td className={SX.dataTd}>Dr. Meena Singh</td>
                <td className={SX.dataTd}>90 min</td>
                <td className={cn(SX.dataTd, "text-[#1565c0]")}>Edit / Delete</td>
              </tr>
            </tbody>
          </table>
          <button type="button" className={cn(SX.btnGhost, "mt-3")}>
            + Add class
          </button>
        </div>
      ) : (
        <div className="overflow-auto">
          <div className="mb-2 flex justify-between text-[13px]">
            <button type="button" className="font-medium text-[#1565c0] hover:underline">
              ← Prev week
            </button>
            <span className="font-semibold text-[#212121]">Week of Apr 2026</span>
            <button type="button" className="font-medium text-[#1565c0] hover:underline">
              Next week →
            </button>
          </div>
          <div className="grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] gap-px border border-[#d0d0d0] bg-[#d0d0d0] text-[11px]">
            <div className="bg-[#f2f2f2] p-1" />
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div
                key={d}
                className={cn(
                  "bg-[#f2f2f2] p-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#424242]",
                  i === 0 && "bg-[#e3f2fd]",
                )}
              >
                {d}
              </div>
            ))}
            {hours.map((h) => (
              <Fragment key={h}>
                <div className="bg-white p-1 text-[#757575]">
                  {h > 12 ? `${h - 12} PM` : `${h} AM`}
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                  <div
                    key={`${h}-${c}`}
                    className={cn(
                      "min-h-[28px] bg-white p-0.5",
                      c === 0 && "bg-[#fafafa]",
                    )}
                  >
                    {h === 9 && c === 0 && (
                      <div
                        className="rounded-none bg-[#2e7d32] px-1 py-0.5 text-[10px] font-medium text-white"
                        title="Biology · Dr. Meena · 90 min"
                      >
                        Biology
                      </div>
                    )}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e8e8e8] pt-3">
        <span className="text-[13px] font-semibold">Send schedule</span>
        <button type="button" className="rounded-none bg-[#25d366] px-3 py-1.5 text-[13px] text-white hover:bg-[#1fb855]">
          WhatsApp
        </button>
        <button type="button" className={SX.btnPrimary}>
          Email
        </button>
      </div>
      </div>
    </section>
  );
}
