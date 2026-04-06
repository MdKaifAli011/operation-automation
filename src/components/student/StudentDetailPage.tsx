"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  format,
  formatDistanceToNow,
  parseISO,
  startOfWeek,
} from "date-fns";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { LeadPipelineScheduleClass } from "@/lib/leadPipelineMetaTypes";
import type {
  CallHistoryEntry,
  Faculty,
  Lead,
  PipelineActivity,
} from "@/lib/types";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import { formatTargetExams } from "@/lib/lead-display";
import { formatLeadPhone } from "@/lib/phone-display";
import {
  PIPELINE_STEP_LABELS,
  appendActivity,
  canAccessPipelineStep,
  canGoToNextPipelineStep,
  mergePipelineMeta,
} from "@/lib/pipeline";
import { primaryExamForFee } from "@/lib/examFeeDefaults";
import { extrasForLead } from "@/lib/student-detail";
import { SX } from "@/components/student/student-excel-ui";
import {
  IconCalendar,
  IconCalendarLarge,
  IconCheck,
  IconCloudUpload,
  IconFileText,
  IconLink,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSparkles,
  IconTrash,
} from "@/components/icons/CrmIcons";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: "step-1", n: 1, label: "Demo" },
  { id: "step-2", n: 2, label: "Brochure" },
  { id: "step-3", n: 3, label: "Fees" },
  { id: "step-4", n: 4, label: "Schedule" },
] as const;

const PIPELINE_TOTAL = STEPS.length;

/** Success toast modal after scheduling a demo */
const DEMO_SCHEDULE_SUCCESS_AUTO_CLOSE_MS = 3200;

/** IST wall-clock → instant (scheduling is always interpreted as Asia/Kolkata). */
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

/** Calendar date as it reads in that zone (can differ from India when the slot crosses midnight). */
function formatDateInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

const STUDENT_TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "India — IST" },
  { value: "Asia/Kathmandu", label: "Nepal — NPT" },
  { value: "Asia/Dubai", label: "UAE — GST" },
  { value: "Asia/Singapore", label: "Singapore — SGT" },
  { value: "Asia/Riyadh", label: "Saudi Arabia — AST" },
  { value: "Asia/Kuwait", label: "Kuwait — AST" },
  { value: "Europe/London", label: "UK — GMT / BST" },
  { value: "America/New_York", label: "US — Eastern" },
  { value: "America/Los_Angeles", label: "US — Pacific" },
];

function zoneShortLabel(tz: string): string {
  const o = STUDENT_TIMEZONE_OPTIONS.find((x) => x.value === tz);
  if (!o) return tz.replace(/^.*\//, "");
  const parts = o.label.split(" — ");
  return (parts[1] ?? parts[0]).trim();
}

function studentTimeZoneMenuLabel(tz: string): string {
  return (
    STUDENT_TIMEZONE_OPTIONS.find((o) => o.value === tz)?.label ?? tz
  );
}

/** One instant; message spells out IST + student zone so ops trust both were considered. */
function buildPastSlotWarning(slot: Date, studentTz: string): string {
  const ist = `${formatDateInZone(slot, "Asia/Kolkata")}, ${formatTime12hInZone(slot, "Asia/Kolkata")} IST`;
  const st = `${formatDateInZone(slot, studentTz)}, ${formatTime12hInZone(slot, studentTz)} ${zoneShortLabel(studentTz)}`;
  return (
    "This demo time is already in the past — it cannot be created. " +
    "Checked in India (IST) and in the student timezone. " +
    `India: ${ist}. Student (${studentTimeZoneMenuLabel(studentTz)}): ${st}. ` +
    "Choose a later time or a future date."
  );
}

function validateScheduledDemoSlot(
  isoDate: string,
  timeHmIST: string,
  studentTimeZone: string,
): string | null {
  const slot = parseIstSlot(isoDate, timeHmIST);
  if (!slot) return "Enter a valid date and time.";
  if (slot.getTime() < Date.now()) return buildPastSlotWarning(slot, studentTimeZone);
  return null;
}

const DEMO_EDIT_SUBJECTS = [
  "Biology",
  "Physics",
  "Chemistry",
  "Mathematics",
  "English",
  "GK",
  "Reasoning",
] as const;

function demoRowSummaryLine(r: DemoTableRow): string {
  const slot = parseIstSlot(r.isoDate, r.timeHmIST);
  const ist = slot
    ? `${format(parseISO(r.isoDate), "d MMM yyyy")} · ${formatTime12hInZone(slot, "Asia/Kolkata")} IST`
    : r.isoDate;
  return `${r.subject} · ${r.teacher} · ${ist}`;
}

function defaultStudentTimeZone(country: string): string {
  const c = country.trim().toLowerCase();
  if (c === "uae" || c.includes("emirates")) return "Asia/Dubai";
  if (c === "singapore") return "Asia/Singapore";
  if (c === "nepal") return "Asia/Kathmandu";
  if (c === "saudi" || c === "ksa") return "Asia/Riyadh";
  return "Asia/Kolkata";
}

function pickDefaultTeacher(subj: string, faculties: Faculty[]): string {
  if (faculties.length > 0) {
    const L = (s: string) => s.toLowerCase();
    const bySub = (kw: string) =>
      faculties.find((f) => f.subjects.some((x) => L(x).includes(kw)));
    if (subj === "Biology") {
      const m = bySub("bio") ?? faculties.find((f) => f.name.includes("Meena"));
      if (m) return m.name;
    }
    if (subj === "Physics") {
      const m = bySub("phys") ?? faculties.find((f) => f.name.includes("Ravi"));
      if (m) return m.name;
    }
    if (subj === "Chemistry") {
      const m = bySub("chem");
      if (m) return m.name;
    }
    if (subj === "Mathematics") {
      const m = bySub("math");
      if (m) return m.name;
    }
    const m =
      bySub("english") ??
      bySub("reason") ??
      bySub("cuet") ??
      faculties[0];
    return m.name;
  }
  return "";
}

type DemoTableRow = {
  subject: string;
  teacher: string;
  studentTimeZone: string;
  status: string;
  /** yyyy-MM-dd — source of truth for display */
  isoDate: string;
  /** HH:mm wall clock in India (IST) */
  timeHmIST: string;
  inviteSent?: boolean;
  inviteSentAt?: string | null;
};

function activityIconForKind(kind: PipelineActivity["kind"]) {
  switch (kind) {
    case "demo":
      return IconCalendar;
    case "brochure":
      return IconMail;
    case "fees":
      return IconFileText;
    case "schedule":
      return IconCalendar;
    case "call":
      return IconPhone;
    case "note":
      return IconPencil;
    default:
      return IconPlus;
  }
}

function formatActivityTime(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

type Props = { lead: Lead };

export function StudentDetailPage({ lead: initialLead }: Props) {
  const [lead, setLead] = useState(initialLead);
  const leadRef = useRef(lead);
  leadRef.current = lead;
  useEffect(() => {
    setLead(initialLead);
  }, [initialLead]);

  const patchLead = useCallback(
    async (updates: Partial<Lead>) => {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Could not save.",
        );
      }
      setLead(data as Lead);
      return data as Lead;
    },
    [lead.id],
  );

  const extras = useMemo(() => extrasForLead(lead), [lead]);
  const completed = lead.pipelineSteps;
  const [activeStep, setActiveStep] = useState(() => {
    const c = initialLead.pipelineSteps;
    if (c >= PIPELINE_TOTAL) return PIPELINE_TOTAL;
    return Math.min(Math.max(c, 0) + 1, PIPELINE_TOTAL);
  });

  useEffect(() => {
    const c = initialLead.pipelineSteps;
    setActiveStep(
      c >= PIPELINE_TOTAL
        ? PIPELINE_TOTAL
        : Math.min(Math.max(c, 0) + 1, PIPELINE_TOTAL),
    );
  }, [initialLead.id]);
  const [notes, setNotes] = useState(initialLead.workspaceNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const skipNotesAutosave = useRef(true);

  useEffect(() => {
    skipNotesAutosave.current = true;
  }, [lead.id]);

  useEffect(() => {
    setNotes(lead.workspaceNotes ?? "");
  }, [lead.workspaceNotes, lead.id]);

  useEffect(() => {
    if (skipNotesAutosave.current) {
      skipNotesAutosave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const next = notes.trimEnd();
      const cur = leadRef.current;
      const prev = (cur.workspaceNotes ?? "").trimEnd();
      if (next === prev) return;
      setNotesSaving(true);
      void patchLead({
        workspaceNotes: next,
        activityLog: appendActivity(
          cur.activityLog,
          "note",
          "Workspace notes saved",
        ),
      })
        .then(() => {
          setNotesSaved(true);
          window.setTimeout(() => setNotesSaved(false), 2000);
        })
        .finally(() => setNotesSaving(false));
    }, 750);
    return () => window.clearTimeout(t);
  }, [notes, lead.id, patchLead]);
  const [callOpen, setCallOpen] = useState(false);
  const [scheduleView, setScheduleView] = useState<"table" | "calendar">(() => {
    const v = (initialLead.pipelineMeta?.schedule as { view?: string } | undefined)
      ?.view;
    return v === "calendar" ? "calendar" : "table";
  });
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  const maxAccessibleStep = completed >= PIPELINE_TOTAL ? PIPELINE_TOTAL : completed + 1;

  useEffect(() => {
    if (activeStep > maxAccessibleStep) {
      setActiveStep(maxAccessibleStep);
    }
  }, [maxAccessibleStep, activeStep]);

  useEffect(() => {
    const v = (lead.pipelineMeta?.schedule as { view?: string } | undefined)?.view;
    if (v === "calendar" || v === "table") setScheduleView(v);
  }, [lead.id, lead.pipelineMeta]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/faculties")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        setFaculties(data as Faculty[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const badgeClass =
    lead.rowTone === "interested"
      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
      : lead.rowTone === "not_interested"
        ? "bg-red-50 text-red-800 ring-1 ring-red-100"
        : lead.rowTone === "followup_later"
          ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
          : "bg-sky-50 text-sky-900 ring-1 ring-sky-100";

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
            <span className="text-slate-300" aria-hidden>
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
                  "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  badgeClass,
                )}
              >
                {extras.statusLabel}
              </span>
            </div>

            <dl
              className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-4 sm:gap-x-8"
              role="group"
              aria-label="Primary contact details"
            >
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1 text-[13px] font-medium tabular-nums text-slate-900">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="hover:text-primary hover:underline"
                    >
                      {formatLeadPhone(lead)}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Target exams
                </dt>
                <dd className="mt-1">
                  <span className={SX.studentHeroCourseBadge}>
                    {formatTargetExams(lead.targetExams)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Country
                </dt>
                <dd className="mt-1 text-[13px] font-medium text-slate-900">
                  {extras.country}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Lead date
                </dt>
                <dd className="mt-1 text-[13px] font-medium tabular-nums text-slate-900">
                  {format(parseISO(lead.date), "dd/MM/yyyy")}
                </dd>
              </div>
            </dl>

            <div className={SX.studentHeroSubline}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <span className={SX.studentHeroSubLabel}>Parent</span>{" "}
                  <span className={SX.studentHeroSubVal}>
                    {lead.parentName || "—"}
                  </span>
                </span>
                <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" aria-hidden />
                <span>
                  <span className={SX.studentHeroSubLabel}>Sheet</span>{" "}
                  <span className={SX.studentHeroSubVal}>{sheetTabLabel}</span>
                </span>
                <span className="hidden h-3 w-px bg-slate-200 sm:inline-block" aria-hidden />
                <span>
                  <span className={SX.studentHeroSubLabel}>Pipeline</span>{" "}
                  <span className={SX.studentHeroSubVal}>
                    {pipeDone}/{PIPELINE_TOTAL}
                  </span>
                </span>
              </div>
              <p className="mt-2">
                <span className={SX.studentHeroSubLabel}>Email</span>{" "}
                <a
                  href={`mailto:${extras.email}`}
                  className="font-medium text-primary hover:underline"
                  title={extras.email}
                >
                  {extras.email}
                </a>
              </p>
            </div>
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
              {activeStep === 1 && (
                <DemoSection
                  lead={lead}
                  faculties={faculties}
                  onPatchLead={patchLead}
                />
              )}
              {activeStep === 2 && (
                <BrochureSection lead={lead} onPatchLead={patchLead} />
              )}
              {activeStep === 3 && (
                <FeeSection lead={lead} onPatchLead={patchLead} />
              )}
              {activeStep === 4 && (
                <ScheduleSection
                  lead={lead}
                  view={scheduleView}
                  onViewChange={setScheduleView}
                  onPatchLead={patchLead}
                />
              )}
            </div>
            <StepFooter
              completed={completed}
              activeStep={activeStep}
              onStepChange={setActiveStep}
            />
          </div>

          <aside className={SX.asidePane}>
            <p className={SX.asideIntro}>
              Activity, notes, and calls for this lead.
            </p>
            <ActivityAside activities={lead.activityLog} />

            <div className={SX.sidePanel}>
              <div className={SX.sideHead}>Notes</div>
              <div className={SX.sideBody}>
                <textarea
                  rows={8}
                  className={cn(SX.textarea, "min-h-[140px] resize-y")}
                  placeholder="Type notes here — auto-saved for your team."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                {(notesSaving || notesSaved) && (
                  <p
                    className={cn(
                      "mt-2 flex items-center gap-1 text-[12px]",
                      notesSaving ? "text-slate-500" : "text-success",
                    )}
                  >
                    {notesSaving ? (
                      "Saving…"
                    ) : (
                      <>
                        <IconCheck className="h-3.5 w-3.5" /> Saved
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            <CallHistoryPanel
              lead={lead}
              callOpen={callOpen}
              onToggleOpen={() => setCallOpen((v) => !v)}
              onPatchLead={patchLead}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function CallHistoryPanel({
  lead,
  callOpen,
  onToggleOpen,
  onPatchLead,
}: {
  lead: Lead;
  callOpen: boolean;
  onToggleOpen: () => void;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
}) {
  const [callDate, setCallDate] = useState("");
  const [duration, setDuration] = useState("");
  const [outcome, setOutcome] = useState("Interested");
  const [callNotes, setCallNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const calls = lead.callHistory ?? [];

  return (
    <div className={SX.sidePanel}>
      <div className={SX.sideHead}>Call history</div>
      <div className={SX.sideBody}>
        {calls.length === 0 ? (
          <p className="text-[13px] text-slate-500">No calls logged yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-[13px]">
            {calls.map((c, i) => {
              let when = "—";
              try {
                when = format(parseISO(c.at), "dd MMM yyyy, HH:mm");
              } catch {
                when = c.at;
              }
              return (
                <li key={`${c.at}-${i}`} className="flex flex-col gap-1 py-3 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="tabular-nums text-slate-600">{when}</span>
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[11px] font-medium",
                        c.outcome === "Interested"
                          ? "bg-emerald-50 text-emerald-800"
                          : c.outcome === "Not Interested"
                            ? "bg-red-50 text-red-800"
                            : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {c.outcome || "—"}
                    </span>
                  </div>
                  {c.duration ? (
                    <p className="text-[11px] text-slate-500">Duration: {c.duration}</p>
                  ) : null}
                  {c.notes ? (
                    <p className="text-[12px] text-slate-600">{c.notes}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <button
          type="button"
          className={cn(
            SX.btnGhost,
            "mt-4 w-full justify-center border border-dashed border-slate-200 py-2.5 text-slate-600 hover:bg-slate-50",
          )}
          onClick={onToggleOpen}
        >
          + Log call
        </button>
        {callOpen && (
          <form
            className="mt-3 space-y-2 border border-slate-200 bg-slate-50/80 p-3 text-[13px]"
            onSubmit={(e) => {
              e.preventDefault();
              setSaving(true);
              const entry: CallHistoryEntry = {
                at: new Date().toISOString(),
                outcome,
                duration: duration.trim(),
                notes: callNotes.trim(),
              };
              const dateLabel = callDate
                ? format(parseISO(callDate), "dd MMM yyyy")
                : format(new Date(), "dd MMM yyyy");
              void onPatchLead({
                callHistory: [entry, ...calls],
                activityLog: appendActivity(
                  lead.activityLog,
                  "call",
                  `Call logged — ${outcome}${callDate ? ` (${dateLabel})` : ""}`,
                ),
              })
                .then(() => {
                  setCallDate("");
                  setDuration("");
                  setOutcome("Interested");
                  setCallNotes("");
                  onToggleOpen();
                })
                .finally(() => setSaving(false));
            }}
          >
            <input
              type="date"
              className={SX.input}
              value={callDate}
              onChange={(e) => setCallDate(e.target.value)}
              aria-label="Call date"
            />
            <input
              placeholder="Duration (e.g. 12 min)"
              className={SX.input}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <select
              className={cn(SX.select, "w-full")}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="Interested">Interested</option>
              <option value="No Answer">No Answer</option>
              <option value="Callback">Callback</option>
              <option value="Not Interested">Not Interested</option>
            </select>
            <input
              placeholder="Notes"
              className={SX.input}
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
            />
            <button
              type="submit"
              className={cn(SX.btnPrimary, "w-full")}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save call"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ActivityAside({
  activities,
}: {
  activities: PipelineActivity[] | undefined;
}) {
  const [showAll, setShowAll] = useState(false);
  const list = activities ?? [];
  const recent = list.slice(0, 5);
  const display = showAll ? list : recent;

  return (
    <div className={SX.sidePanel}>
      <div className={SX.sideHead}>Activity</div>
      <div className={SX.sideBody}>
        {list.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-slate-500">
            No activity yet. Completing pipeline steps and saving notes will appear
            here.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {showAll ? "All activity" : "Recent"}
            </p>
            <ul className="max-h-[min(40vh,320px)] divide-y divide-slate-100 overflow-y-auto text-[13px] [scrollbar-width:thin]">
              {display.map((a, i) => {
                const StepIcon = activityIconForKind(a.kind);
                return (
                  <li
                    key={`${a.at}-${i}-${a.message.slice(0, 24)}`}
                    className="flex gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <StepIcon
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug text-slate-800">{a.message}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatActivityTime(a.at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {list.length > 5 ? (
              <button
                type="button"
                className={cn(
                  SX.btnGhost,
                  "mt-2 w-full justify-center text-[12px]",
                )}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? "Show recent only" : `Show all (${list.length})`}
              </button>
            ) : null}
          </>
        )}
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
    <div className="border-b border-slate-100 bg-white">
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
        <div
          className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto rounded-md bg-slate-200/90 p-1 shadow-inner shadow-slate-900/[0.05] [scrollbar-width:thin]"
          role="tablist"
          aria-label={`Pipeline: ${doneCount} of ${PIPELINE_TOTAL} done. Open step below.`}
        >
          {STEPS.map((s) => {
            const isDone = completed >= s.n;
            const isActive = activeStep === s.n;
            const unlocked = canAccessPipelineStep(completed, s.n);
            const lockHint =
              s.n >= 2
                ? `Complete ${PIPELINE_STEP_LABELS[s.n - 2]} first`
                : "";
            return (
              <button
                key={s.id}
                type="button"
                id={`pipeline-tab-${s.n}`}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? "step" : undefined}
                disabled={!unlocked}
                title={
                  !unlocked
                    ? lockHint
                    : isDone
                      ? `${s.label} — completed`
                      : isActive
                        ? `${s.label} — open (in progress)`
                        : `${s.label} — not started`
                }
                onClick={() => {
                  if (unlocked) onStepSelect(s.n);
                }}
                className={cn(
                  "flex min-h-9 min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-left text-[12px] font-medium transition-all sm:min-w-0 sm:px-2.5",
                  !unlocked && "cursor-not-allowed opacity-45",
                  isActive &&
                    unlocked &&
                    "bg-white font-semibold text-primary shadow-sm ring-1 ring-slate-200/70",
                  !isActive &&
                    isDone &&
                    unlocked &&
                    "text-emerald-900 hover:bg-white/80",
                  !isActive &&
                    !isDone &&
                    unlocked &&
                    "text-slate-700 hover:bg-white/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold tabular-nums leading-none transition-colors",
                    isDone &&
                      "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 ring-2 ring-emerald-300/90",
                    !isDone &&
                      isActive &&
                      "border-2 border-primary bg-white text-primary shadow-sm ring-2 ring-primary/20",
                    !isDone &&
                      !isActive &&
                      "border border-slate-300 bg-white text-slate-700",
                  )}
                  aria-hidden
                >
                  {isDone ? (
                    <IconCheck className="h-3.5 w-3.5 text-white" />
                  ) : (
                    s.n
                  )}
                </span>
                <span className="min-w-0 truncate sm:text-[13px]">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-2.5 sm:flex-col sm:items-end sm:border-l sm:border-slate-200 sm:pl-3"
          title={`${doneCount} of ${PIPELINE_TOTAL} onboarding steps completed`}
        >
          <p className="min-w-0 text-[11px] leading-tight text-slate-600 sm:text-right sm:text-xs">
            <span className="sr-only">Currently viewing: </span>
            <span className="font-semibold text-slate-900">{activeLabel}</span>
            <span className="text-slate-300" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <span className="tabular-nums text-slate-700">
              <span className="font-bold text-slate-900">{doneCount}</span>/
              {PIPELINE_TOTAL}
            </span>
          </p>
          <div
            className="relative h-1.5 w-full min-w-[5.5rem] max-w-[140px] overflow-hidden rounded-full bg-slate-200 sm:max-w-[160px]"
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={PIPELINE_TOTAL}
            aria-label={`${doneCount} of ${PIPELINE_TOTAL} steps completed`}
          >
            <div
              className="h-full rounded-full bg-emerald-500 shadow-sm shadow-emerald-900/20 transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepFooter({
  completed,
  activeStep,
  onStepChange,
}: {
  completed: number;
  activeStep: number;
  onStepChange: (n: number) => void;
}) {
  const label = STEPS.find((s) => s.n === activeStep)?.label ?? "";
  const canNext = canGoToNextPipelineStep(completed, activeStep);
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
      <span
        className="max-w-[min(100%,220px)] truncate text-center text-[11px] text-[#78909c]"
        title={
          !canNext && activeStep < PIPELINE_TOTAL
            ? "Mark this step complete before going to the next"
            : undefined
        }
      >
        Step {activeStep}/{PIPELINE_TOTAL} · {label}
      </span>
      <button
        type="button"
        disabled={activeStep >= PIPELINE_TOTAL || !canNext}
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

function DemoSection({
  lead,
  faculties,
  onPatchLead,
}: {
  lead: Lead;
  faculties: Faculty[];
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
}) {
  const leadRef = useRef(lead);
  leadRef.current = lead;
  const demoRowsFromMeta = (
    lead.pipelineMeta?.demo as { rows?: DemoTableRow[] } | undefined
  )?.rows;
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<DemoTableRow[]>(() =>
    Array.isArray(demoRowsFromMeta) ? demoRowsFromMeta : [],
  );
  const [scheduleSuccessOpen, setScheduleSuccessOpen] = useState(false);
  const dismissScheduleSuccess = useCallback(() => setScheduleSuccessOpen(false), []);
  const [shareSuccessOpen, setShareSuccessOpen] = useState(false);
  const dismissShareSuccess = useCallback(() => setShareSuccessOpen(false), []);

  const [rowAction, setRowAction] = useState<
    | { type: "edit"; index: number }
    | { type: "delete"; index: number }
    | { type: "send"; index: number }
    | null
  >(null);
  const [editDraft, setEditDraft] = useState<DemoTableRow | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const closeRowModal = useCallback(() => {
    setRowAction(null);
    setEditDraft(null);
    setEditError(null);
  }, []);

  const patchEditDraft = useCallback((patch: Partial<DemoTableRow>) => {
    setEditDraft((d) => (d ? { ...d, ...patch } : null));
    setEditError(null);
  }, []);

  const saveEditRow = useCallback(() => {
    if (!editDraft || rowAction?.type !== "edit") return;
    const err = validateScheduledDemoSlot(
      editDraft.isoDate,
      editDraft.timeHmIST,
      editDraft.studentTimeZone,
    );
    if (err) {
      setEditError(err);
      return;
    }
    const i = rowAction.index;
    setRows((prev) => prev.map((row, j) => (j === i ? { ...editDraft } : row)));
    closeRowModal();
  }, [editDraft, rowAction, closeRowModal]);

  const confirmDeleteRow = useCallback(() => {
    if (rowAction?.type !== "delete") return;
    const i = rowAction.index;
    setRows((prev) => prev.filter((_, j) => j !== i));
    closeRowModal();
  }, [rowAction, closeRowModal]);

  const confirmSendRow = useCallback(() => {
    if (rowAction?.type !== "send") return;
    const idx = rowAction.index;
    const row = rows[idx];
    closeRowModal();
    setShareSuccessOpen(true);
    if (row) {
      const at = new Date().toISOString();
      const nextRows = rows.map((r, j) =>
        j === idx ? { ...r, inviteSent: true, inviteSentAt: at } : r,
      );
      setRows(nextRows);
      void onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          demo: {
            rows: nextRows,
            lastInviteSharedAt: at,
            lastInviteSummary: demoRowSummaryLine(row),
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "demo",
          `Demo invite shared with family: ${demoRowSummaryLine(row)}`,
        ),
      });
    }
  }, [rowAction, rows, closeRowModal, onPatchLead, lead.pipelineMeta, lead.activityLog]);

  useEffect(() => {
    const r = (
      lead.pipelineMeta?.demo as { rows?: DemoTableRow[] } | undefined
    )?.rows;
    if (Array.isArray(r)) setRows(r);
  }, [lead.id, lead.pipelineMeta]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const server = (
        lead.pipelineMeta?.demo as { rows?: DemoTableRow[] } | undefined
      )?.rows;
      if (JSON.stringify(rows) === JSON.stringify(server ?? [])) return;
      void onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          demo: { rows },
        }),
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [rows, lead.id, onPatchLead, lead.pipelineMeta]);

  const activeRow =
    rowAction && rows[rowAction.index] ? rows[rowAction.index] : null;

  const showAddInHeader = rows.length > 0 && !expanded;

  const demoActionBtn =
    "inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-sm border border-[#e0e0e0] bg-white px-2 text-[11px] font-medium text-[#424242] transition-colors hover:border-[#bdbdbd] hover:bg-[#fafafa] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#1565c0]";

  return (
    <>
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={SX.sectionTitle}>Step 1 · Demo classes</h2>
            {lead.pipelineSteps >= 1 ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-100">
                Done
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 max-w-xl text-xs leading-snug text-slate-500">
            Schedule in <span className="font-medium text-slate-600">IST</span>.{" "}
            <span className="font-medium text-slate-600">Student time</span> is their
            local date &amp; time on the invite.
          </p>
        </div>
        {showAddInHeader ? (
          <button
            type="button"
            className={cn(
              SX.btnPrimary,
              "inline-flex shrink-0 items-center gap-1.5",
            )}
            onClick={() => setExpanded(true)}
          >
            <IconPlus className="h-3.5 w-3.5" />
            Add another demo
          </button>
        ) : null}
      </div>
      <div className={SX.sectionBody}>
      {rows.length > 0 ? (
        <div
          className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-3 text-[13px] text-emerald-950 shadow-sm shadow-emerald-900/5"
          role="status"
        >
          <p className="font-semibold tracking-tight">
            {rows.length === 1
              ? "1 demo saved on this lead"
              : `${rows.length} demos saved on this lead`}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-emerald-900/85">
            Open this tab anytime to see the full table. Each row is stored in the
            database.
          </p>
          <ul className="mt-2 space-y-1 border-t border-emerald-200/80 pt-2 text-[12px] text-emerald-900">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="font-medium tabular-nums text-emerald-800">
                  #{i + 1}
                </span>
                <span>{demoRowSummaryLine(r)}</span>
                <span className="text-emerald-700/80">· {r.status}</span>
                {r.inviteSent ? (
                  <span className="rounded bg-emerald-600/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900">
                    Invite sent
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rows.length === 0 && !expanded ? (
        <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 bg-slate-50/60 px-3 py-5 text-center">
          <IconCalendarLarge className="h-10 w-10 text-slate-300" />
          <div className="space-y-0.5">
            <p className="text-[13px] font-semibold text-slate-800">
              No demo scheduled yet
            </p>
            <p className="mx-auto max-w-[280px] text-[12px] leading-snug text-slate-500">
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
          faculties={faculties}
          onCancel={() => setExpanded(false)}
          onSchedule={(r) => {
            const nextRows = [r];
            setRows(nextRows);
            setExpanded(false);
            setScheduleSuccessOpen(true);
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                demo: { rows: nextRows },
              }),
              activityLog: appendActivity(
                lead.activityLog,
                "demo",
                `Demo created & saved on lead — ${r.subject} with ${r.teacher} · ${format(parseISO(r.isoDate), "d MMM yyyy")} IST`,
              ),
            });
          }}
        />
      ) : (
        <div className="overflow-auto">
          <table className={cn(SX.dataTable, "min-w-[520px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>#</th>
                <th className={SX.dataTh}>Subject</th>
                <th className={SX.dataTh}>Teacher</th>
                <th className={SX.dataTh}>When (India)</th>
                <th className={SX.dataTh}>Student time</th>
                <th className={SX.dataTh}>Status</th>
                <th className={SX.dataTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const slot = parseIstSlot(r.isoDate, r.timeHmIST);
                return (
                  <tr key={i} className="min-h-[44px]">
                    <td
                      className={cn(
                        SX.dataTd,
                        "py-2.5 align-top tabular-nums",
                        i % 2 === 1 && SX.zebraRow,
                      )}
                    >
                      {i + 1}
                    </td>
                    <td
                      className={cn(
                        SX.dataTd,
                        "max-w-[120px] py-2.5 align-top font-medium",
                        i % 2 === 1 && SX.zebraRow,
                      )}
                    >
                      {r.subject}
                    </td>
                    <td
                      className={cn(
                        SX.dataTd,
                        "max-w-[min(200px,28vw)] py-2.5 align-top text-[12px] leading-snug",
                        i % 2 === 1 && SX.zebraRow,
                      )}
                    >
                      {r.teacher}
                    </td>
                    <td
                      className={cn(
                        SX.dataTd,
                        "min-w-[128px] py-2.5 align-top",
                        i % 2 === 1 && SX.zebraRow,
                      )}
                    >
                      {slot ? (
                        <>
                          <div className="text-[13px] font-medium leading-tight text-[#212121]">
                            {format(parseISO(r.isoDate), "d MMM yyyy")}
                          </div>
                          <div className="mt-0.5 text-[12px] leading-tight text-[#546e7a]">
                            {formatTime12hInZone(slot, "Asia/Kolkata")} IST
                          </div>
                        </>
                      ) : (
                        <span className="text-[12px] text-[#b71c1c]">—</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        SX.dataTdMuted,
                        "min-w-[148px] py-2.5 align-top",
                        i % 2 === 1 && SX.zebraRow,
                      )}
                    >
                      {slot ? (
                        <>
                          <div className="text-[13px] font-medium leading-tight text-[#424242]">
                            {formatDateInZone(slot, r.studentTimeZone)}
                          </div>
                          <div className="mt-0.5 text-[12px] leading-tight text-[#546e7a]">
                            {formatTime12hInZone(slot, r.studentTimeZone)}{" "}
                            {zoneShortLabel(r.studentTimeZone)}
                          </div>
                        </>
                      ) : (
                        <span className="text-[12px]">—</span>
                      )}
                    </td>
                    <td
                      className={cn(SX.dataTd, "py-2.5 align-top", i % 2 === 1 && SX.zebraRow)}
                    >
                      <select
                        className={cn(
                          SX.select,
                          "h-7 w-full min-w-[104px] max-w-[128px] text-[12px]",
                        )}
                        value={r.status}
                        onChange={(e) =>
                          setRows((prev) =>
                            prev.map((row, j) =>
                              j === i ? { ...row, status: e.target.value } : row,
                            ),
                          )
                        }
                        aria-label={`Status for ${r.subject} demo`}
                      >
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td
                      className={cn(SX.dataTd, "py-2.5 align-top", i % 2 === 1 && SX.zebraRow)}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={demoActionBtn}
                          aria-label="Edit demo"
                          onClick={() => {
                            setEditDraft({ ...r });
                            setEditError(null);
                            setRowAction({ type: "edit", index: i });
                          }}
                        >
                          <IconPencil />
                          Edit
                        </button>
                        <button
                          type="button"
                          className={cn(
                            demoActionBtn,
                            "hover:border-[#ffcdd2] hover:bg-[#fff8f8] hover:text-[#c62828]",
                          )}
                          aria-label="Delete demo"
                          onClick={() => setRowAction({ type: "delete", index: i })}
                        >
                          <IconTrash />
                          Delete
                        </button>
                        <button
                          type="button"
                          className={cn(
                            demoActionBtn,
                            "text-[#1565c0] hover:border-[#90caf9] hover:bg-[#e3f2fd]",
                          )}
                          aria-label="Share demo invite"
                          onClick={() => setRowAction({ type: "send", index: i })}
                        >
                          <IconLink />
                          Share
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {!expanded
              ? "More demos: use Add another demo in the header."
              : "Complete the form below to add a row."}
          </p>
          {expanded && (
            <DemoForm
              lead={lead}
              faculties={faculties}
              onCancel={() => setExpanded(false)}
              onSchedule={(r) => {
                setRows((prev) => {
                  const nextRows = [...prev, r];
                  queueMicrotask(() => {
                    const L = leadRef.current;
                    void onPatchLead({
                      pipelineMeta: mergePipelineMeta(L.pipelineMeta, {
                        demo: { rows: nextRows },
                      }),
                      activityLog: appendActivity(
                        L.activityLog,
                        "demo",
                        `Demo created & saved on lead — ${r.subject} with ${r.teacher} · ${format(parseISO(r.isoDate), "d MMM yyyy")} IST`,
                      ),
                    });
                  });
                  return nextRows;
                });
                setExpanded(false);
                setScheduleSuccessOpen(true);
              }}
            />
          )}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-snug text-slate-500">
        Demos save automatically. Adding a demo updates pipeline progress.
      </p>
      </div>
    </section>
    <DemoEditRowDialog
      open={rowAction?.type === "edit"}
      draft={editDraft}
      faculties={faculties}
      onDraftChange={patchEditDraft}
      onClose={closeRowModal}
      onSave={saveEditRow}
      error={editError}
    />
    <DemoDeleteRowDialog
      open={rowAction?.type === "delete"}
      summary={activeRow ? demoRowSummaryLine(activeRow) : ""}
      onClose={closeRowModal}
      onConfirm={confirmDeleteRow}
    />
    <DemoSendRowDialog
      open={rowAction?.type === "send"}
      lead={lead}
      summary={activeRow ? demoRowSummaryLine(activeRow) : ""}
      onClose={closeRowModal}
      onConfirm={confirmSendRow}
    />
    <DemoScheduleSuccessDialog
      open={scheduleSuccessOpen}
      onDismiss={dismissScheduleSuccess}
    />
    <DemoScheduleSuccessDialog
      open={shareSuccessOpen}
      onDismiss={dismissShareSuccess}
      headerTitle="Sent"
      headline="Invite queued"
      body="The demo join link will be sent to the parent using your usual channel (SMS / WhatsApp / email)."
      autoCloseMs={DEMO_SCHEDULE_SUCCESS_AUTO_CLOSE_MS}
    />
    </>
  );
}

function DemoEditRowDialog({
  open,
  draft,
  faculties,
  onDraftChange,
  onClose,
  onSave,
  error,
}: {
  open: boolean;
  draft: DemoTableRow | null;
  faculties: Faculty[];
  onDraftChange: (patch: Partial<DemoTableRow>) => void;
  onClose: () => void;
  onSave: () => void;
  error: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const show = open && draft != null;

  const subjectOptions = useMemo(() => {
    if (!draft) return [...DEMO_EDIT_SUBJECTS];
    const set = new Set<string>(DEMO_EDIT_SUBJECTS);
    return set.has(draft.subject)
      ? [...DEMO_EDIT_SUBJECTS]
      : [draft.subject, ...DEMO_EDIT_SUBJECTS];
  }, [draft]);

  const teacherOptions = useMemo(() => {
    const names = faculties.map((f) => f.name);
    if (!draft) return names;
    return names.includes(draft.teacher)
      ? names
      : draft.teacher
        ? [draft.teacher, ...names]
        : names;
  }, [draft, faculties]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [show, onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[205] w-[min(100vw-1rem,26rem)] max-h-[min(92vh,640px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-[#d0d0d0] bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      aria-labelledby="demo-edit-title"
    >
      <div className="flex items-center justify-between border-b border-[#d0d0d0] bg-[#e3f2fd] px-3 py-2.5">
        <h2
          id="demo-edit-title"
          className="text-[13px] font-bold tracking-tight text-[#0d47a1]"
        >
          Edit demo
        </h2>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center text-[18px] leading-none text-[#546e7a] hover:bg-black/5"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      {draft ? (
        <div className="max-h-[min(70vh,480px)] overflow-y-auto px-3 py-3">
          <div className="space-y-3 text-[13px]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Subject
              </label>
              <select
                className={cn(SX.select, "w-full")}
                value={draft.subject}
                onChange={(e) => onDraftChange({ subject: e.target.value })}
              >
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Teacher
              </label>
              <select
                className={cn(SX.select, "w-full")}
                value={draft.teacher}
                onChange={(e) => onDraftChange({ teacher: e.target.value })}
              >
                {teacherOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Date (IST calendar)
              </label>
              <input
                type="date"
                min={todayStr}
                className={cn(SX.input)}
                value={draft.isoDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v >= todayStr) onDraftChange({ isoDate: v });
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Start time (IST)
              </label>
              <input
                type="time"
                className={cn(SX.input, "max-w-[140px]")}
                value={draft.timeHmIST}
                onChange={(e) => onDraftChange({ timeHmIST: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Student timezone
              </label>
              <select
                className={cn(SX.select, "w-full")}
                value={draft.studentTimeZone}
                onChange={(e) => onDraftChange({ studentTimeZone: e.target.value })}
              >
                {STUDENT_TIMEZONE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#757575]">
                Status
              </label>
              <select
                className={cn(SX.select, "w-full")}
                value={draft.status}
                onChange={(e) => onDraftChange({ status: e.target.value })}
              >
                <option value="Scheduled">Scheduled</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          {error ? (
            <p
              className="mt-3 border border-[#ffcdd2] bg-[#ffebee] px-2 py-2 text-[12px] leading-relaxed text-[#b71c1c]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#eceff1] bg-[#fafafa] px-3 py-2.5">
        <button type="button" className={SX.btnSecondary} onClick={() => ref.current?.close()}>
          Cancel
        </button>
        <button type="button" className={SX.btnPrimary} onClick={onSave}>
          Save changes
        </button>
      </div>
    </dialog>
  );
}

function DemoDeleteRowDialog({
  open,
  summary,
  onClose,
  onConfirm,
}: {
  open: boolean;
  summary: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[205] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-[#d0d0d0] bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      aria-labelledby="demo-delete-title"
    >
      <div className="flex items-center justify-between border-b border-[#ffcdd2] bg-[#ffebee] px-3 py-2.5">
        <h2
          id="demo-delete-title"
          className="text-[13px] font-bold tracking-tight text-[#b71c1c]"
        >
          Delete demo
        </h2>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center text-[18px] leading-none text-[#b71c1c] hover:bg-black/5"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      <div className="px-3 py-4">
        <p className="text-[13px] leading-relaxed text-[#37474f]">
          Remove this demo from the list? This cannot be undone.
        </p>
        {summary ? (
          <p className="mt-2 border border-[#eceff1] bg-[#fafafa] px-2 py-2 text-[12px] leading-snug text-[#546e7a]">
            {summary}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#eceff1] bg-[#fafafa] px-3 py-2.5">
        <button type="button" className={SX.btnSecondary} onClick={() => ref.current?.close()}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded-none border border-[#b71c1c] bg-[#c62828] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#b71c1c]"
          onClick={onConfirm}
        >
          Delete
        </button>
      </div>
    </dialog>
  );
}

function DemoSendRowDialog({
  open,
  lead,
  summary,
  onClose,
  onConfirm,
}: {
  open: boolean;
  lead: Lead;
  summary: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[205] w-[min(100vw-1.5rem,24rem)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-[#d0d0d0] bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      aria-labelledby="demo-send-title"
    >
      <div className="flex items-center justify-between border-b border-[#90caf9] bg-[#e3f2fd] px-3 py-2.5">
        <h2
          id="demo-send-title"
          className="text-[13px] font-bold tracking-tight text-[#0d47a1]"
        >
          Send demo link
        </h2>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center text-[18px] leading-none text-[#1565c0] hover:bg-black/5"
          aria-label="Close"
          onClick={() => ref.current?.close()}
        >
          ×
        </button>
      </div>
      <div className="px-3 py-4">
        <p className="text-[13px] leading-relaxed text-[#37474f]">
          Share the join link with the parent for this trial class.
        </p>
        {summary ? (
          <p className="mt-2 border border-[#eceff1] bg-[#fafafa] px-2 py-2 text-[12px] leading-snug text-[#546e7a]">
            {summary}
          </p>
        ) : null}
        <p className="mt-3 text-[12px] text-[#757575]">
          <span className="font-semibold text-[#546e7a]">{lead.parentName}</span>
          {" · "}
          <span className="tabular-nums">{formatLeadPhone(lead)}</span>
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-[#eceff1] bg-[#fafafa] px-3 py-2.5">
        <button type="button" className={SX.btnSecondary} onClick={() => ref.current?.close()}>
          Cancel
        </button>
        <button type="button" className={SX.btnPrimary} onClick={onConfirm}>
          Send link
        </button>
      </div>
    </dialog>
  );
}

function DemoScheduleSuccessDialog({
  open,
  onDismiss,
  headerTitle = "Success",
  headline = "Success!",
  body = "The demo was scheduled successfully.",
  autoCloseMs = DEMO_SCHEDULE_SUCCESS_AUTO_CLOSE_MS,
}: {
  open: boolean;
  onDismiss: () => void;
  headerTitle?: string;
  headline?: string;
  body?: string;
  /** Set 0 to disable auto-close (e.g. share confirmation). */
  autoCloseMs?: number;
}) {
  const titleId = useId();
  const descId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [exiting, setExiting] = useState(false);

  const finishClose = useCallback(() => {
    const d = ref.current;
    if (!d?.open) return;
    closingRef.current = false;
    setExiting(false);
    d.close();
  }, []);

  const beginClose = useCallback(() => {
    if (closingRef.current) return;
    const d = ref.current;
    if (!d?.open) return;
    closingRef.current = true;
    const panel = panelRef.current;
    if (panel) {
      panel.classList.remove("animate-demo-success-panel-in");
      void panel.offsetWidth;
    }
    setExiting(true);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      closingRef.current = false;
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      closingRef.current = false;
      setExiting(false);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || exiting || autoCloseMs <= 0) return;
    const id = window.setTimeout(beginClose, autoCloseMs);
    return () => window.clearTimeout(id);
  }, [open, exiting, beginClose, autoCloseMs]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      beginClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [beginClose]);

  useEffect(() => {
    if (!open) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdropMouseDown = (e: MouseEvent) => {
      if (e.target === dlg) beginClose();
    };
    dlg.addEventListener("mousedown", onBackdropMouseDown);
    return () => dlg.removeEventListener("mousedown", onBackdropMouseDown);
  }, [open, beginClose]);

  const onPanelAnimationEnd = (e: React.AnimationEvent<HTMLDivElement>) => {
    if (!closingRef.current) return;
    if (!e.animationName.includes("demo-success-panel-out")) return;
    finishClose();
  };

  useEffect(() => {
    if (!exiting) return;
    const id = window.setTimeout(() => {
      if (closingRef.current && ref.current?.open) finishClose();
    }, 400);
    return () => window.clearTimeout(id);
  }, [exiting, finishClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "demo-schedule-success fixed inset-0 z-[210] m-0 h-full max-h-none w-full max-w-none",
        "border-0 bg-transparent p-0 shadow-none",
        "backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:items-center open:justify-center",
      )}
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target === e.currentTarget) beginClose();
      }}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div
        ref={panelRef}
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] origin-center overflow-hidden rounded-none border border-[#d0d0d0] bg-white shadow-2xl shadow-black/20",
          exiting
            ? "animate-demo-success-panel-out"
            : "animate-demo-success-panel-in",
        )}
        onAnimationEnd={onPanelAnimationEnd}
      >
        <div className="flex items-center justify-between border-b border-[#1b5e20] bg-[#2e7d32] px-3 py-2.5">
          <h2
            id={titleId}
            className="text-[13px] font-bold tracking-tight text-white"
          >
            {headerTitle}
          </h2>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center text-[18px] leading-none text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-1 focus-visible:ring-white"
            aria-label="Close"
            onClick={beginClose}
          >
            ×
          </button>
        </div>
        <div className="px-4 pb-4 pt-5 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#2e7d32] shadow-sm"
            aria-hidden
          >
            <IconCheck className="h-6 w-6 text-white" />
          </div>
          <p className="text-[15px] font-bold text-[#212121]">{headline}</p>
          <p
            id={descId}
            className="mt-2 text-[13px] leading-relaxed text-[#546e7a]"
          >
            {body}
          </p>
        </div>
        <div className="flex justify-end border-t border-[#eceff1] bg-[#fafafa] px-3 py-2.5">
          <button
            type="button"
            className="rounded-none border border-[#1b5e20] bg-[#2e7d32] px-4 py-1.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors hover:bg-[#1b5e20] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2e7d32]"
            onClick={beginClose}
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

function DemoScheduleWarningDialog({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (message) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [message]);

  useEffect(() => {
    if (!message) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdropMouseDown = (e: MouseEvent) => {
      if (e.target === dlg) onDismiss();
    };
    dlg.addEventListener("mousedown", onBackdropMouseDown);
    return () => dlg.removeEventListener("mousedown", onBackdropMouseDown);
  }, [message, onDismiss]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,520px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-[#d0d0d0] bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onDismiss}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      aria-labelledby="demo-schedule-warn-title"
    >
      <div className="border-b border-[#ffcdd2] bg-[#ffebee] px-3 py-2.5">
        <h2
          id="demo-schedule-warn-title"
          className="text-[13px] font-bold tracking-tight text-[#b71c1c]"
        >
          Cannot schedule demo
        </h2>
      </div>
      <div className="max-h-[min(60vh,320px)] overflow-y-auto px-3 py-3">
        <p className="text-[13px] leading-relaxed text-[#37474f]">{message ?? ""}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#eceff1] bg-[#fafafa] px-3 py-2">
        <button
          type="button"
          className={SX.btnPrimary}
          onClick={() => ref.current?.close()}
        >
          OK
        </button>
      </div>
    </dialog>
  );
}

function DemoForm({
  lead,
  faculties,
  onCancel,
  onSchedule,
}: {
  lead: Lead;
  faculties: Faculty[];
  onCancel: () => void;
  onSchedule: (r: DemoTableRow) => void;
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
  const [teacher, setTeacher] = useState(() =>
    pickDefaultTeacher(subj, faculties),
  );
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [demoDate, setDemoDate] = useState(todayStr);
  const [demoTime, setDemoTime] = useState("10:00");
  const [studentTimeZone, setStudentTimeZone] = useState(() =>
    defaultStudentTimeZone(lead.country),
  );
  const [scheduleWarnMsg, setScheduleWarnMsg] = useState<string | null>(null);
  const dismissScheduleWarn = useCallback(() => setScheduleWarnMsg(null), []);
  /** If the tab crosses midnight, raw `demoDate` can lag; never schedule or show a past calendar day. */
  const effectiveDemoDate = demoDate < todayStr ? todayStr : demoDate;

  const studentLocalPreview = useMemo(() => {
    const slot = parseIstSlot(effectiveDemoDate, demoTime);
    if (!slot || Number.isNaN(slot.getTime())) return "";
    return `${formatDateInZone(slot, studentTimeZone)} · ${formatTime12hInZone(slot, studentTimeZone)} ${zoneShortLabel(studentTimeZone)}`;
  }, [effectiveDemoDate, demoTime, studentTimeZone]);

  const teacherNameOptions = useMemo(() => faculties.map((f) => f.name), [faculties]);

  const effectiveTeacher = useMemo(() => {
    if (teacherNameOptions.includes(teacher)) return teacher;
    return teacherNameOptions[0] ?? "";
  }, [teacher, teacherNameOptions]);

  const pickSubject = (s: string) => {
    setScheduleWarnMsg(null);
    setSubj(s);
    setTeacher(pickDefaultTeacher(s, faculties));
  };

  return (
    <>
    <div
      className="mt-2 overflow-hidden border-t border-slate-100 pt-2"
      role="form"
      aria-label="Schedule demo class"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <h3 className={SX.sectionTitle}>Schedule a trial class</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Schedule in <span className="font-medium text-slate-700">IST</span> (left).
            Set the student&apos;s timezone (right) so invites show the right local time
            — default follows country ({lead.country}).
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-sm border border-slate-200">
        <div className="overflow-x-auto">
        <table className={cn(SX.dataTable, "w-full min-w-[280px]")}>
          <tbody>
            <tr>
              <th
                scope="row"
                className={cn(SX.dataTh, "w-[min(36%,180px)] align-top")}
              >
                Exam &amp; subject
              </th>
              <td className={SX.dataTd}>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <select
                    className={cn(SX.select, "w-full min-w-[140px] max-w-[200px]")}
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
                    aria-label="Target exam"
                  >
                    {demoTargetOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Subject for this demo"
                  >
                    {subs.map((s) => (
                      <label
                        key={s}
                        className={cn(
                          "inline-flex cursor-pointer items-center border px-2.5 py-1.5 text-[13px]",
                          subj === s
                            ? "border-[#1565c0] bg-[#e3f2fd] font-medium text-[#1565c0]"
                            : "border-[#d0d0d0] bg-white text-[#424242] hover:bg-[#f5f5f5]",
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
                </div>
              </td>
            </tr>
            <tr>
              <th scope="row" className={cn(SX.dataTh, "align-middle")}>
                Teacher
              </th>
              <td className={SX.dataTd}>
                <select
                  className={cn(SX.select, "w-full max-w-[320px]")}
                  value={effectiveTeacher}
                  onChange={(e) => {
                    setScheduleWarnMsg(null);
                    setTeacher(e.target.value);
                  }}
                  aria-label="Teacher"
                  disabled={teacherNameOptions.length === 0}
                >
                  {teacherNameOptions.length === 0 ? (
                    <option value="">— Add faculty under Faculties first —</option>
                  ) : (
                    teacherNameOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )}
                </select>
                {teacherNameOptions.length === 0 ? (
                  <p className="mt-1.5 text-[12px] text-amber-800">
                    No teachers in the system yet. Add faculty so demos can be assigned.
                  </p>
                ) : null}
              </td>
            </tr>
            <tr>
              <th scope="row" className={cn(SX.dataTh, "align-top")}>
                When
              </th>
              <td className={SX.dataTd}>
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
                  <div className="min-w-0 space-y-2">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#757575]">
                      India (IST)
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        min={todayStr}
                        value={effectiveDemoDate}
                        onChange={(e) => {
                          setScheduleWarnMsg(null);
                          const v = e.target.value;
                          if (v >= todayStr) setDemoDate(v);
                        }}
                        className={cn(SX.input, "w-[148px]")}
                        aria-invalid={!!scheduleWarnMsg}
                        aria-label="Demo date (IST)"
                      />
                      <span className="text-[12px] text-[#9e9e9e]" aria-hidden={true}>
                        at
                      </span>
                      <input
                        type="time"
                        value={demoTime}
                        onChange={(e) => {
                          setScheduleWarnMsg(null);
                          setDemoTime(e.target.value);
                        }}
                        className={cn(SX.input, "w-[112px]")}
                        aria-label="Start time India Standard Time"
                      />
                      <span className="text-[11px] font-medium text-[#616161]">
                        IST
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-2 border-t border-[#e0e0e0] pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                    <label
                      htmlFor="demo-student-tz"
                      className="block text-[10px] font-semibold uppercase tracking-wide text-[#757575]"
                    >
                      Student timezone
                    </label>
                    <select
                      id="demo-student-tz"
                      className={cn(SX.select, "w-full max-w-[320px]")}
                      value={studentTimeZone}
                      onChange={(e) => {
                        setScheduleWarnMsg(null);
                        setStudentTimeZone(e.target.value);
                      }}
                      aria-label="Student timezone for invite preview"
                    >
                      {STUDENT_TIMEZONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {studentLocalPreview ? (
                      <div className="space-y-1">
                        <p className="text-[12px] leading-snug text-[#424242]">
                          <span className="text-[#757575]">Preview: </span>
                          {studentLocalPreview}
                        </p>
                        <p className="text-[10px] leading-snug text-[#9e9e9e]">
                          You can schedule for any local time. The slot must still be in
                          the future (checked in IST and the student timezone above).
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2">
          <button type="button" className={SX.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={!effectiveTeacher.trim()}
            onClick={() => {
              setScheduleWarnMsg(null);
              if (!effectiveTeacher.trim()) {
                setScheduleWarnMsg("Choose a teacher from your faculty list.");
                return;
              }
              const slot = parseIstSlot(effectiveDemoDate, demoTime);
              if (!slot) {
                setScheduleWarnMsg("Enter a valid date and time.");
                return;
              }
              const now = new Date();
              if (slot.getTime() < now.getTime()) {
                setScheduleWarnMsg(buildPastSlotWarning(slot, studentTimeZone));
                return;
              }
              onSchedule({
                subject: subj,
                teacher: effectiveTeacher,
                studentTimeZone,
                status: "Scheduled",
                isoDate: effectiveDemoDate,
                timeHmIST: demoTime,
              });
            }}
          >
            Schedule demo
          </button>
        </div>
      </div>
    </div>
    <DemoScheduleWarningDialog
      message={scheduleWarnMsg}
      onDismiss={dismissScheduleWarn}
    />
    </>
  );
}

function BrochureSection({
  lead,
  onPatchLead,
}: {
  lead: Lead;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
}) {
  const br = lead.pipelineMeta?.brochure as
    | {
        notes?: string;
        fileName?: string | null;
        generated?: boolean;
        sentWhatsApp?: boolean;
        sentEmail?: boolean;
        sentWhatsAppAt?: string;
        sentEmailAt?: string;
      }
    | undefined;
  const [file, setFile] = useState<File | null>(null);
  const [genPreview, setGenPreview] = useState(br?.generated ?? false);
  const [notes, setNotes] = useState(br?.notes ?? "");
  const [savedName, setSavedName] = useState<string | null>(br?.fileName ?? null);
  const brochureSkipAutosave = useRef(true);
  const leadBrRef = useRef(lead);
  leadBrRef.current = lead;

  useEffect(() => {
    brochureSkipAutosave.current = true;
  }, [lead.id]);

  useEffect(() => {
    const b = lead.pipelineMeta?.brochure as
      | {
          notes?: string;
          fileName?: string | null;
          generated?: boolean;
        }
      | undefined;
    if (b) {
      setNotes(b.notes ?? "");
      setSavedName(b.fileName ?? null);
      setGenPreview(b.generated ?? false);
    }
  }, [lead.id, lead.pipelineMeta]);

  const brochureFileLabel = file?.name ?? savedName ?? "";
  const formatSentAt = (iso?: string) => {
    if (!iso) return "";
    try {
      return format(parseISO(iso), "dd MMM yyyy, HH:mm");
    } catch {
      return "";
    }
  };

  const brochurePayload = useCallback(
    (patch: Record<string, unknown> = {}) => ({
      notes,
      fileName: file?.name ?? savedName,
      generated: genPreview,
      ...patch,
    }),
    [notes, file, savedName, genPreview],
  );

  useEffect(() => {
    if (brochureSkipAutosave.current) {
      brochureSkipAutosave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const L = leadBrRef.current;
      const prev = (L.pipelineMeta?.brochure as { notes?: string } | undefined)
        ?.notes;
      if ((prev ?? "") === notes) return;
      void onPatchLead({
        pipelineMeta: mergePipelineMeta(L.pipelineMeta, {
          brochure: brochurePayload(),
        }),
      });
    }, 650);
    return () => window.clearTimeout(t);
  }, [notes, brochurePayload, onPatchLead]);

  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={SX.sectionTitle}>Step 2 · Course brochure</h2>
            {lead.pipelineSteps >= 2 ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-100">
                Done
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Upload or generate a PDF, then send to the family. Everything below is
            stored on this lead.
          </p>
        </div>
      </div>
      <div className={SX.sectionBody}>
      {br?.generated ||
      br?.sentWhatsApp ||
      br?.sentEmail ||
      brochureFileLabel ||
      notes.trim() ? (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-800 shadow-sm shadow-slate-900/5">
          <p className="font-semibold text-slate-900">Brochure on this student</p>
          {brochureFileLabel ? (
            <p className="mt-1.5 text-[13px]">
              <span className="text-slate-500">File: </span>
              <span className="font-medium text-slate-900">{brochureFileLabel}</span>
            </p>
          ) : (
            <p className="mt-1.5 text-[12px] text-slate-500">No file name saved yet.</p>
          )}
          {br?.generated ? (
            <p className="mt-1 text-[12px] font-medium text-emerald-800">
              ✓ Brochure generated (preview)
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {br?.sentWhatsApp ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-[#25d366]/15 px-2 py-1 text-[11px] font-semibold text-[#1b5e20] ring-1 ring-[#25d366]/30">
                <IconCheck className="h-3 w-3" /> Sent WhatsApp
                {br.sentWhatsAppAt ? (
                  <span className="font-normal text-emerald-900/80">
                    · {formatSentAt(br.sentWhatsAppAt)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                WhatsApp — not sent yet
              </span>
            )}
            {br?.sentEmail ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/25">
                <IconCheck className="h-3 w-3" /> Sent email
                {br.sentEmailAt ? (
                  <span className="font-normal text-slate-700">
                    · {formatSentAt(br.sentEmailAt)}
                  </span>
                ) : null}
              </span>
            ) : (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500">
                Email — not sent yet
              </span>
            )}
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="flex h-[180px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-[13px] text-slate-600">
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const nextFile = e.target.files?.[0] ?? null;
                setFile(nextFile);
                const name = nextFile?.name ?? null;
                setSavedName(name);
                const patch: Partial<Lead> = {
                  pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                    brochure: {
                      notes,
                      fileName: name,
                      generated: genPreview,
                    },
                  }),
                };
                if (nextFile) {
                  patch.activityLog = appendActivity(
                    lead.activityLog,
                    "brochure",
                    `Brochure file attached: ${nextFile.name}`,
                  );
                }
                void onPatchLead(patch);
              }}
            />
            <IconCloudUpload />
            <span>Upload PDF or image</span>
            <span className="text-[12px] text-slate-400">PDF, JPG, PNG</span>
          </label>
          {file && (
            <p className="mt-2 text-[13px]">
              {file.name} ({Math.round(file.size / 1024)} KB) ·{" "}
              <button type="button" className="text-[#1565c0] underline">
                Preview
              </button>{" "}
              ·{" "}
              <button
                type="button"
                className="text-[#c62828] underline"
                onClick={() => {
                  setFile(null);
                  void onPatchLead({
                    pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                      brochure: {
                        notes,
                        fileName: null,
                        generated: genPreview,
                      },
                    }),
                  });
                }}
              >
                Remove
              </button>
            </p>
          )}
          {!file && savedName ? (
            <p className="mt-2 text-[13px] text-slate-600">
              Saved file: <span className="font-medium">{savedName}</span>
            </p>
          ) : null}
        </div>
        <div>
          <label className="text-[13px] font-semibold text-slate-900">
            Generate from performance notes
          </label>
          <textarea
            rows={4}
            className={cn(SX.textarea, "mt-2")}
            placeholder="Demo performance notes, strengths, areas to improve…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            type="button"
            className={cn(SX.btnPrimary, "mt-2 gap-2")}
            onClick={() => {
              window.setTimeout(() => {
                setGenPreview(true);
                void onPatchLead({
                  pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                    brochure: {
                      notes,
                      fileName: file?.name ?? savedName,
                      generated: true,
                    },
                  }),
                  activityLog: appendActivity(
                    lead.activityLog,
                    "brochure",
                    `Brochure generated from notes — saved on this lead${(file?.name ?? savedName) ? ` (file: ${file?.name ?? savedName})` : ""}.`,
                  ),
                });
              }, 400);
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
      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          className="rounded-none bg-[#25d366] px-4 py-2 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-[#1fb855]"
          onClick={() => {
            const label = brochureFileLabel || "Course brochure";
            const now = new Date().toISOString();
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                brochure: {
                  ...brochurePayload(),
                  sentWhatsApp: true,
                  sentWhatsAppAt: now,
                },
              }),
              activityLog: appendActivity(
                lead.activityLog,
                "brochure",
                `Brochure "${label}" marked sent via WhatsApp (saved on this lead).`,
              ),
            });
          }}
        >
          Send via WhatsApp
        </button>
        <button
          type="button"
          className={SX.btnPrimary}
          onClick={() => {
            const label = brochureFileLabel || "Course brochure";
            const now = new Date().toISOString();
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                brochure: {
                  ...brochurePayload(),
                  sentEmail: true,
                  sentEmailAt: now,
                },
              }),
              activityLog: appendActivity(
                lead.activityLog,
                "brochure",
                `Brochure "${label}" marked sent via email (saved on this lead).`,
              ),
            });
          }}
        >
          Send via email
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Notes save automatically. Generate, upload, or send via WhatsApp / email to
        advance the pipeline.
      </p>
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

function FeeSection({
  lead,
  onPatchLead,
}: {
  lead: Lead;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
}) {
  const [scholarshipPct, setScholarshipPct] = useState(0);
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentCount, setInstallmentCount] =
    useState<(typeof INSTALLMENT_COUNT_OPTIONS)[number]>(2);
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>([]);
  const [installmentDates, setInstallmentDates] = useState<string[]>([]);
  const [baseTotal, setBaseTotal] = useState(0);
  const feesSkipAutosave = useRef(true);
  const leadFeesRef = useRef(lead);
  leadFeesRef.current = lead;
  /** After we resolve exam default or see a saved base fee, skip re-fetching. */
  const examDefaultFillResolvedRef = useRef(false);

  useEffect(() => {
    feesSkipAutosave.current = true;
    examDefaultFillResolvedRef.current = false;
  }, [lead.id]);

  const finalFee = useMemo(
    () => Math.round(baseTotal * (1 - scholarshipPct / 100)),
    [baseTotal, scholarshipPct],
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
    const nextFinal = Math.round(baseTotal * (1 - v / 100));
    if (installmentEnabled) {
      setInstallmentAmounts(splitFeeEvenly(nextFinal, installmentCount));
    }
  };

  const onBaseTotalChange = (value: string) => {
    const n = Number(String(value).replace(/,/g, ""));
    const v = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
    setBaseTotal(v);
    const nextFinal = Math.round(v * (1 - scholarshipPct / 100));
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

  useEffect(() => {
    const f = lead.pipelineMeta?.fees as
      | {
          scholarshipPct?: number;
          installmentEnabled?: boolean;
          installmentCount?: number;
          installmentAmounts?: number[];
          installmentDates?: string[];
          currency?: string;
          baseTotal?: number;
        }
      | undefined;
    if (!f || typeof f !== "object") return;
    if (typeof f.scholarshipPct === "number") setScholarshipPct(f.scholarshipPct);
    if (typeof f.installmentEnabled === "boolean")
      setInstallmentEnabled(f.installmentEnabled);
    if (
      typeof f.installmentCount === "number" &&
      (INSTALLMENT_COUNT_OPTIONS as readonly number[]).includes(f.installmentCount)
    ) {
      setInstallmentCount(
        f.installmentCount as (typeof INSTALLMENT_COUNT_OPTIONS)[number],
      );
    }
    if (Array.isArray(f.installmentAmounts)) setInstallmentAmounts(f.installmentAmounts);
    if (Array.isArray(f.installmentDates)) setInstallmentDates(f.installmentDates);
    if (typeof f.currency === "string") setCurrency(f.currency);
    if (typeof f.baseTotal === "number" && Number.isFinite(f.baseTotal) && f.baseTotal >= 0) {
      setBaseTotal(Math.round(f.baseTotal));
    }
  }, [lead.id, lead.pipelineMeta]);

  useEffect(() => {
    const fees = leadFeesRef.current.pipelineMeta?.fees as
      | { baseTotal?: number }
      | undefined;
    const saved =
      typeof fees?.baseTotal === "number" && Number.isFinite(fees.baseTotal)
        ? fees.baseTotal
        : 0;
    if (saved > 0) {
      examDefaultFillResolvedRef.current = true;
      return;
    }
    if (examDefaultFillResolvedRef.current) return;

    const exam = primaryExamForFee(lead.targetExams);
    if (!exam) {
      examDefaultFillResolvedRef.current = true;
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/exam-fee-structures", {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const rows = (await res.json()) as { exam: string; baseFee: number }[];
        const hit = rows.find((r) => r.exam === exam);
        const def = hit?.baseFee;
        if (cancelled) return;
        if (typeof def !== "number" || def <= 0) {
          examDefaultFillResolvedRef.current = true;
          return;
        }
        setBaseTotal((prev) => (prev > 0 ? prev : Math.round(def)));
        examDefaultFillResolvedRef.current = true;
      } catch {
        examDefaultFillResolvedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lead.id, lead.targetExams]);

  const buildFeesMeta = useCallback(() => {
    const prev = leadFeesRef.current.pipelineMeta?.fees as
      | Record<string, unknown>
      | undefined;
    return {
      scholarshipPct,
      installmentEnabled,
      installmentCount,
      installmentAmounts,
      installmentDates,
      currency,
      baseTotal,
      finalFee,
      feeSentWhatsApp: !!prev?.feeSentWhatsApp,
      feeSentEmail: !!prev?.feeSentEmail,
      enrollmentSent: !!prev?.enrollmentSent,
      feeSentWhatsAppAt:
        typeof prev?.feeSentWhatsAppAt === "string"
          ? prev.feeSentWhatsAppAt
          : undefined,
      feeSentEmailAt:
        typeof prev?.feeSentEmailAt === "string"
          ? prev.feeSentEmailAt
          : undefined,
      enrollmentSentAt:
        typeof prev?.enrollmentSentAt === "string"
          ? prev.enrollmentSentAt
          : undefined,
    };
  }, [
    scholarshipPct,
    installmentEnabled,
    installmentCount,
    installmentAmounts,
    installmentDates,
    currency,
    baseTotal,
    finalFee,
  ]);

  useEffect(() => {
    if (feesSkipAutosave.current) {
      feesSkipAutosave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const L = leadFeesRef.current;
      void onPatchLead({
        pipelineMeta: mergePipelineMeta(L.pipelineMeta, {
          fees: buildFeesMeta(),
        }),
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [buildFeesMeta, onPatchLead]);

  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={SX.sectionTitle}>Step 3 · Fee structure</h2>
            {lead.pipelineSteps >= 3 ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-100">
                Done
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Base fee can load from Fee Management defaults by target exam (e.g. NEET).
            Scholarship, final fee, and installments save automatically.
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
        {(() => {
          const fm = lead.pipelineMeta?.fees as
            | {
                feeSentWhatsApp?: boolean;
                feeSentEmail?: boolean;
                enrollmentSent?: boolean;
                feeSentWhatsAppAt?: string;
                feeSentEmailAt?: string;
                enrollmentSentAt?: string;
              }
            | undefined;
          const fmt = (iso?: string) => {
            if (!iso) return "";
            try {
              return format(parseISO(iso), "dd MMM yyyy, HH:mm");
            } catch {
              return "";
            }
          };
          return (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] shadow-sm shadow-slate-900/5">
              <p className="font-semibold text-slate-900">Fee sends on this lead</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {fm?.feeSentWhatsApp ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#25d366]/15 px-2 py-1 text-[11px] font-semibold text-[#1b5e20] ring-1 ring-[#25d366]/30">
                    <IconCheck className="h-3 w-3" /> Fee structure · WhatsApp sent
                    {fm.feeSentWhatsAppAt ? (
                      <span className="font-normal text-emerald-900/80">
                        · {fmt(fm.feeSentWhatsAppAt)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                    Fee · WhatsApp — not sent
                  </span>
                )}
                {fm?.feeSentEmail ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/25">
                    <IconCheck className="h-3 w-3" /> Fee structure · Email sent
                    {fm.feeSentEmailAt ? (
                      <span className="font-normal text-slate-700">
                        · {fmt(fm.feeSentEmailAt)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                    Fee · Email — not sent
                  </span>
                )}
                {fm?.enrollmentSent ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200">
                    <IconCheck className="h-3 w-3" /> Enrollment form sent
                    {fm.enrollmentSentAt ? (
                      <span className="font-normal text-violet-800/90">
                        · {fmt(fm.enrollmentSentAt)}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                    Enrollment form — not sent
                  </span>
                )}
              </div>
            </div>
          );
        })()}
        <div className="overflow-auto border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
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
                <td className={SX.dataTd}>
                  <label className="sr-only" htmlFor={`base-fee-${lead.id}`}>
                    Base course fee (INR)
                  </label>
                  <input
                    id={`base-fee-${lead.id}`}
                    type="number"
                    min={0}
                    className={cn(SX.input, "w-full min-w-[120px] max-w-[180px] tabular-nums")}
                    value={baseTotal}
                    onChange={(e) => onBaseTotalChange(e.target.value)}
                    aria-label="Base course fee in Indian rupees"
                  />
                </td>
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
          <div className="mt-3 overflow-hidden border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
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
            onClick={() => {
              const now = new Date().toISOString();
              void onPatchLead({
                pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                  fees: {
                    ...buildFeesMeta(),
                    feeSentWhatsApp: true,
                    feeSentWhatsAppAt: now,
                  },
                }),
                activityLog: appendActivity(
                  lead.activityLog,
                  "fees",
                  `Fee structure (₹${finalFee.toLocaleString("en-IN")} final) marked sent on WhatsApp — saved on lead.`,
                ),
              });
            }}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className={SX.btnPrimary}
            onClick={() => {
              const now = new Date().toISOString();
              void onPatchLead({
                pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                  fees: {
                    ...buildFeesMeta(),
                    feeSentEmail: true,
                    feeSentEmailAt: now,
                  },
                }),
                activityLog: appendActivity(
                  lead.activityLog,
                  "fees",
                  `Fee structure (₹${finalFee.toLocaleString("en-IN")} final) marked sent by email — saved on lead.`,
                ),
              });
            }}
          >
            Email
          </button>
          <button
            type="button"
            className={cn(
              SX.btnSecondary,
              "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100",
            )}
            onClick={() => {
              const now = new Date().toISOString();
              void onPatchLead({
                pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                  fees: {
                    ...buildFeesMeta(),
                    enrollmentSent: true,
                    enrollmentSentAt: now,
                  },
                }),
                activityLog: appendActivity(
                  lead.activityLog,
                  "fees",
                  "Enrollment form marked sent to family — saved on lead.",
                ),
              });
            }}
          >
            Send enrollment form
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Scholarship and installments save automatically. Use send actions to advance
          the pipeline.
        </p>
      </div>
    </section>
  );
}

function emptyScheduleClassRow(): LeadPipelineScheduleClass {
  return {
    day: "",
    subject: "",
    timeIST: "",
    timeLocal: "",
    teacher: "",
    duration: "",
  };
}

/** Map weekday label to 0=Mon … 6=Sun for the calendar columns. */
function scheduleDayToIndex(day: string | undefined): number | null {
  if (!day?.trim()) return null;
  const d = day.trim().toLowerCase();
  const map: Record<string, number> = {
    mon: 0,
    monday: 0,
    tue: 1,
    tues: 1,
    tuesday: 1,
    wed: 2,
    wednesday: 2,
    thu: 3,
    thur: 3,
    thurs: 3,
    thursday: 3,
    fri: 4,
    friday: 4,
    sat: 5,
    saturday: 5,
    sun: 6,
    sunday: 6,
  };
  return map[d] ?? null;
}

function ScheduleSection({
  lead,
  view,
  onViewChange,
  onPatchLead,
}: {
  lead: Lead;
  view: "table" | "calendar";
  onViewChange: (v: "table" | "calendar") => void;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
}) {
  const leadSchedRef = useRef(lead);
  leadSchedRef.current = lead;
  const scheduleSkipAutosave = useRef(true);

  const [classes, setClasses] = useState<LeadPipelineScheduleClass[]>([]);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );

  useEffect(() => {
    scheduleSkipAutosave.current = true;
    const sched = lead.pipelineMeta?.schedule;
    const raw =
      sched && typeof sched === "object" && !Array.isArray(sched)
        ? (sched as Record<string, unknown>)
        : {};
    const list = Array.isArray(raw.classes) ? raw.classes : [];
    setClasses(
      list.map((r) =>
        r && typeof r === "object" && !Array.isArray(r)
          ? { ...emptyScheduleClassRow(), ...(r as LeadPipelineScheduleClass) }
          : emptyScheduleClassRow(),
      ),
    );
    if (typeof raw.weekStartIso === "string" && raw.weekStartIso) {
      try {
        setWeekStart(
          startOfWeek(parseISO(raw.weekStartIso), { weekStartsOn: 1 }),
        );
      } catch {
        setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
      }
    } else {
      setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    }
  }, [lead.id]);

  useEffect(() => {
    if (scheduleSkipAutosave.current) {
      scheduleSkipAutosave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const L = leadSchedRef.current;
      const prev =
        L.pipelineMeta?.schedule &&
        typeof L.pipelineMeta.schedule === "object" &&
        !Array.isArray(L.pipelineMeta.schedule)
          ? (L.pipelineMeta.schedule as Record<string, unknown>)
          : {};
      void onPatchLead({
        pipelineMeta: mergePipelineMeta(L.pipelineMeta, {
          schedule: {
            ...prev,
            view,
            classes,
            weekStartIso: weekStart.toISOString(),
            weekLabel: format(weekStart, "'Week of' MMM d, yyyy"),
          },
        }),
      });
    }, 500);
    return () => window.clearTimeout(t);
  }, [view, classes, weekStart, onPatchLead]);

  const updateClass = (
    index: number,
    patch: Partial<LeadPipelineScheduleClass>,
  ) => {
    setClasses((rows) => {
      const next = [...rows];
      const cur = next[index] ?? emptyScheduleClassRow();
      next[index] = { ...cur, ...patch };
      return next;
    });
  };

  const removeClass = (index: number) => {
    setClasses((rows) => rows.filter((_, i) => i !== index));
  };

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  const unassignedDayClasses = useMemo(
    () =>
      classes.filter(
        (c) =>
          scheduleDayToIndex(c.day) === null &&
          Boolean(
            (c.subject && c.subject.trim()) ||
              (c.timeIST && c.timeIST.trim()) ||
              (c.teacher && c.teacher.trim()),
          ),
      ),
    [classes],
  );

  return (
    <section className={SX.section}>
      <div className={SX.sectionHead}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={SX.sectionTitle}>Step 4 · Class schedule</h2>
            {lead.pipelineSteps >= 4 ? (
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 ring-1 ring-emerald-100">
                Done
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-xl text-xs text-slate-500">
            Table or week view for confirmed classes.
          </p>
        </div>
        <div
          className="inline-flex shrink-0 gap-0.5 rounded-md border border-slate-200 bg-slate-200/80 p-1 text-[12px] shadow-inner shadow-slate-900/[0.05]"
          role="tablist"
          aria-label="Schedule view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            className={cn(
              "inline-flex min-h-9 min-w-[5rem] items-center justify-center gap-1.5 rounded-sm px-2.5 py-1.5 font-medium transition-all",
              view === "table"
                ? "bg-white font-semibold text-primary shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
            onClick={() => onViewChange("table")}
          >
            <IconFileText className="h-4 w-4 shrink-0 text-current [&_path]:stroke-[2]" />
            <span className="sm:text-[13px]">Table</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "calendar"}
            className={cn(
              "inline-flex min-h-9 min-w-[5rem] items-center justify-center gap-1.5 rounded-sm px-2.5 py-1.5 font-medium transition-all",
              view === "calendar"
                ? "bg-white font-semibold text-primary shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
            )}
            onClick={() => onViewChange("calendar")}
          >
            <IconCalendar className="h-4 w-4 shrink-0 text-current [&_path]:stroke-[2] [&_rect]:stroke-[2]" />
            <span className="sm:text-[13px]">Calendar</span>
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
              {classes.length === 0 ? (
                <tr>
                  <td
                    className={cn(SX.dataTd, "text-[13px] text-slate-500")}
                    colSpan={7}
                  >
                    No classes yet. Use &quot;Add class&quot; to build the weekly
                    schedule (saved on this lead).
                  </td>
                </tr>
              ) : (
                classes.map((row, i) => (
                  <tr key={i}>
                    <td className={SX.dataTd}>
                      <input
                        className={cn(SX.input, "w-full min-w-[100px] max-w-[140px]")}
                        value={row.day ?? ""}
                        placeholder="e.g. Monday"
                        onChange={(e) => updateClass(i, { day: e.target.value })}
                        aria-label={`Class ${i + 1} day`}
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        className={cn(SX.input, "w-full min-w-[100px]")}
                        value={row.subject ?? ""}
                        onChange={(e) =>
                          updateClass(i, { subject: e.target.value })
                        }
                        aria-label={`Class ${i + 1} subject`}
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        className={cn(SX.input, "w-full min-w-[88px]")}
                        value={row.timeIST ?? ""}
                        placeholder="9:00"
                        onChange={(e) =>
                          updateClass(i, { timeIST: e.target.value })
                        }
                        aria-label={`Class ${i + 1} time IST`}
                      />
                    </td>
                    <td className={SX.dataTdMuted}>
                      <input
                        className={cn(SX.input, "w-full min-w-[88px]")}
                        value={row.timeLocal ?? ""}
                        onChange={(e) =>
                          updateClass(i, { timeLocal: e.target.value })
                        }
                        aria-label={`Class ${i + 1} local time`}
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        className={cn(SX.input, "w-full min-w-[120px]")}
                        value={row.teacher ?? ""}
                        onChange={(e) =>
                          updateClass(i, { teacher: e.target.value })
                        }
                        aria-label={`Class ${i + 1} teacher`}
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        className={cn(SX.input, "w-full min-w-[72px] max-w-[100px]")}
                        value={row.duration ?? ""}
                        placeholder="90 min"
                        onChange={(e) =>
                          updateClass(i, { duration: e.target.value })
                        }
                        aria-label={`Class ${i + 1} duration`}
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-red-700 hover:underline"
                        onClick={() => removeClass(i)}
                      >
                        <IconTrash className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <button
            type="button"
            className={cn(SX.btnGhost, "mt-3")}
            onClick={() =>
              setClasses((rows) => [...rows, emptyScheduleClassRow()])
            }
          >
            + Add class
          </button>
        </div>
      ) : (
        <div className="overflow-auto">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() =>
                setWeekStart((w) => startOfWeek(addWeeks(w, -1), { weekStartsOn: 1 }))
              }
            >
              ← Prev week
            </button>
            <span className="font-semibold text-[#212121]">{weekRangeLabel}</span>
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() =>
                setWeekStart((w) => startOfWeek(addWeeks(w, 1), { weekStartsOn: 1 }))
              }
            >
              Next week →
            </button>
          </div>
          <p className="mb-3 text-[12px] text-slate-500">
            Classes are grouped by weekday name (e.g. Monday). Edit the table view
            for full detail; this week grid updates from the same saved rows.
          </p>
          <div className="grid min-w-[640px] grid-cols-7 gap-2 sm:min-w-[800px]">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
              const dayDate = addDays(weekStart, dayIndex);
              const dayClasses = classes.filter(
                (c) => scheduleDayToIndex(c.day) === dayIndex,
              );
              return (
                <div
                  key={dayIndex}
                  className="flex min-h-[140px] flex-col border border-slate-200 bg-white p-2 text-[11px] shadow-sm"
                >
                  <div className="border-b border-slate-100 pb-1.5 text-center font-semibold text-slate-800">
                    {format(dayDate, "EEE")}
                    <div className="text-[10px] font-normal text-slate-500">
                      {format(dayDate, "MMM d")}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-1 flex-col gap-1.5">
                    {dayClasses.length === 0 ? (
                      <p className="text-[10px] text-slate-400">No classes</p>
                    ) : (
                      dayClasses.map((c, idx) => (
                        <div
                          key={`${c.subject}-${idx}`}
                          className="rounded border border-emerald-200 bg-emerald-50/80 px-1.5 py-1 text-left text-[10px] text-emerald-950"
                        >
                          <div className="font-semibold leading-tight">
                            {c.subject?.trim() || "—"}
                          </div>
                          {c.timeIST?.trim() ? (
                            <div className="text-emerald-900/90">
                              IST {c.timeIST}
                            </div>
                          ) : null}
                          {c.teacher?.trim() ? (
                            <div className="text-emerald-800/80">{c.teacher}</div>
                          ) : null}
                          {c.duration?.trim() ? (
                            <div className="text-emerald-800/70">{c.duration}</div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {unassignedDayClasses.length > 0 ? (
            <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
              Set the <strong>Day</strong> field (e.g. Monday) so rows appear in a
              column:{" "}
              {unassignedDayClasses
                .map((c) => c.subject?.trim() || "Class")
                .join(", ")}
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#e8e8e8] pt-3">
        <span className="text-[13px] font-semibold">Send schedule</span>
        <button
          type="button"
          className="rounded-none bg-[#25d366] px-3 py-1.5 text-[13px] text-white hover:bg-[#1fb855]"
          onClick={() => {
            const prev =
              lead.pipelineMeta?.schedule &&
              typeof lead.pipelineMeta.schedule === "object" &&
              !Array.isArray(lead.pipelineMeta.schedule)
                ? (lead.pipelineMeta.schedule as Record<string, unknown>)
                : {};
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                schedule: {
                  ...prev,
                  view,
                  scheduleSentWhatsApp: true,
                },
              }),
              activityLog: appendActivity(
                lead.activityLog,
                "schedule",
                "Class schedule sent via WhatsApp.",
              ),
            });
          }}
        >
          WhatsApp
        </button>
        <button
          type="button"
          className={SX.btnPrimary}
          onClick={() => {
            const prev =
              lead.pipelineMeta?.schedule &&
              typeof lead.pipelineMeta.schedule === "object" &&
              !Array.isArray(lead.pipelineMeta.schedule)
                ? (lead.pipelineMeta.schedule as Record<string, unknown>)
                : {};
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                schedule: {
                  ...prev,
                  view,
                  scheduleSentEmail: true,
                },
              }),
              activityLog: appendActivity(
                lead.activityLog,
                "schedule",
                "Class schedule sent via email.",
              ),
            });
          }}
        >
          Email
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">
        Table / Calendar choice saves automatically. Send via WhatsApp or email to
        complete the pipeline.
      </p>
      </div>
    </section>
  );
}
