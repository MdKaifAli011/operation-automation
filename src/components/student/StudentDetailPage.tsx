"use client";

import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CallHistoryEntry, Lead, PipelineActivity } from "@/lib/types";
import { GRADE_OPTIONS } from "@/lib/constants";
import {
  LEAD_COUNTRY_OPTIONS,
  dialCodeForCountry,
  digitsOnly,
  normalizeDialCodeInput,
  optionForCountry,
  validateNationalNumber,
} from "@/lib/country-phone";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import { formatLeadPhone } from "@/lib/phone-display";
import {
  appendActivity,
  canAccessPipelineStep,
  canGoToNextPipelineStep,
  PIPELINE_STEP_LABELS,
} from "@/lib/pipeline";
import { extrasForLead } from "@/lib/student-detail";
import { SX } from "@/components/student/student-excel-ui";
import {
  IconCalendar,
  IconCheck,
  IconFileText,
  IconMail,
  IconPencil,
  IconPhone,
  IconPlus,
} from "@/components/icons/CrmIcons";
import { cn } from "@/lib/cn";
import { useLeadSources } from "@/hooks/useLeadSources";
import {
  DemoStepPanel,
  DocumentsStepPanel,
  FeesStepPanel,
  ScheduleStepPanel,
} from "@/components/student/pipeline";

const STEPS = [
  { id: "step-1", n: 1, label: "Demo" },
  { id: "step-2", n: 2, label: "Documents" },
  { id: "step-3", n: 3, label: "Fees" },
  { id: "step-4", n: 4, label: "Schedule" },
] as const;

const PIPELINE_TOTAL = STEPS.length;

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

function leadDateForInput(leadDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(leadDate)) return leadDate.slice(0, 10);
  const parsed = parseISO(leadDate);
  return isValid(parsed)
    ? format(parsed, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
}

type HeroEditDraft = {
  studentName: string;
  parentName: string;
  email: string;
  country: string;
  dialCode: string;
  nationalNumber: string;
  date: string;
  grade: string;
  dataType: string;
  targetExams: string[];
};

const HERO_EDIT_INPUT =
  "box-border w-full min-w-0 rounded-none border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

type Props = { lead: Lead };

export function StudentDetailPage({ lead: initialLead }: Props) {
  const heroFormId = useId();
  const leadSources = useLeadSources();
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

  const refreshLead = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as Lead;
      setLead(data);
    } catch {
      /* ignore */
    }
  }, [lead.id]);

  useEffect(() => {
    const onFocus = () => void refreshLead();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshLead]);

  const extras = useMemo(() => extrasForLead(lead), [lead]);
  const { activeValues: targetExamActiveValues, labelFor: targetExamLabelFor } =
    useTargetExamOptions();
  const heroExamChoiceValues = useMemo(() => {
    const set = new Set<string>();
    for (const v of targetExamActiveValues) set.add(v);
    for (const v of lead.targetExams) {
      const t = typeof v === "string" ? v.trim() : "";
      if (t) set.add(t);
    }
    return [...set];
  }, [targetExamActiveValues, lead.targetExams]);
  const formatTargetExamsLabeled = useCallback(
    (exams: string[] | undefined | null) => {
      if (!exams?.length) return "—";
      return exams.map((v) => targetExamLabelFor(v)).join(", ");
    },
    [targetExamLabelFor],
  );
  const completed = lead.pipelineSteps;
  const [activeStep, setActiveStep] = useState(1);

  useEffect(() => {
    setActiveStep(1);
  }, [initialLead.id]);

  useEffect(() => {
    const maxStep = Math.min(PIPELINE_TOTAL, Math.max(1, completed + 1));
    if (activeStep > maxStep) setActiveStep(maxStep);
  }, [completed, activeStep]);
  const [notes, setNotes] = useState(initialLead.workspaceNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const skipNotesAutosave = useRef(true);

  const [heroEditing, setHeroEditing] = useState(false);
  const [heroDraft, setHeroDraft] = useState<HeroEditDraft | null>(null);
  const [heroSaving, setHeroSaving] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [heroNationalBlurredOnce, setHeroNationalBlurredOnce] = useState(false);
  const [heroNationalFocused, setHeroNationalFocused] = useState(false);

  useEffect(() => {
    setHeroEditing(false);
    setHeroDraft(null);
    setHeroError(null);
    setHeroNationalBlurredOnce(false);
    setHeroNationalFocused(false);
  }, [lead.id]);

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

  const heroNationalDigits = useMemo(
    () => (heroDraft ? digitsOnly(heroDraft.nationalNumber) : ""),
    [heroDraft],
  );

  const heroPhoneFieldError = useMemo(() => {
    if (!heroDraft) return null;
    if (heroNationalDigits.length > 0) {
      return validateNationalNumber(heroDraft.country, heroNationalDigits);
    }
    if (heroNationalBlurredOnce && !heroNationalFocused) {
      return "Enter the phone number.";
    }
    return null;
  }, [
    heroDraft,
    heroNationalDigits,
    heroNationalBlurredOnce,
    heroNationalFocused,
  ]);

  const cancelHeroEdit = useCallback(() => {
    setHeroEditing(false);
    setHeroDraft(null);
    setHeroError(null);
  }, []);

  const beginHeroEdit = useCallback(() => {
    setHeroError(null);
    setHeroNationalBlurredOnce(false);
    setHeroNationalFocused(false);
    const country = LEAD_COUNTRY_OPTIONS.some((c) => c.value === lead.country)
      ? lead.country
      : LEAD_COUNTRY_OPTIONS[0]!.value;
    const dataType = leadSources.some((s) => s.value === lead.dataType)
      ? lead.dataType
      : (leadSources[0]?.value ?? lead.dataType);
    const gradeOk = (GRADE_OPTIONS as readonly string[]).includes(lead.grade);
    setHeroDraft({
      studentName: lead.studentName,
      parentName: lead.parentName.trim() === "—" ? "" : lead.parentName,
      email: lead.email?.trim() ?? "",
      country,
      dialCode: dialCodeForCountry(country),
      nationalNumber: digitsOnly(lead.phone),
      date: leadDateForInput(lead.date),
      grade: gradeOk ? lead.grade : "12th",
      dataType,
      targetExams: [...lead.targetExams],
    });
    setHeroEditing(true);
  }, [lead, leadSources]);

  const saveHeroEdit = useCallback(async () => {
    if (!heroDraft) return;
    const name = heroDraft.studentName.trim();
    if (!name) {
      setHeroError("Student name is required.");
      return;
    }
    const national = digitsOnly(heroDraft.nationalNumber);
    const phoneErr = validateNationalNumber(heroDraft.country, national);
    if (phoneErr) {
      setHeroNationalBlurredOnce(true);
      setHeroError(phoneErr);
      return;
    }
    if (heroDraft.targetExams.length === 0) {
      setHeroError("Select at least one target exam.");
      return;
    }
    if (!leadSources.some((s) => s.value === heroDraft.dataType)) {
      setHeroError("Choose a valid lead source.");
      return;
    }
    setHeroError(null);
    setHeroSaving(true);
    try {
      const cur = leadRef.current;
      await patchLead({
        studentName: name,
        parentName: heroDraft.parentName.trim() || "—",
        email: heroDraft.email.trim(),
        country: heroDraft.country.trim(),
        phone: national,
        date: heroDraft.date,
        grade: heroDraft.grade,
        dataType: heroDraft.dataType,
        targetExams: [...heroDraft.targetExams],
        activityLog: appendActivity(
          cur.activityLog,
          "note",
          "Student profile updated",
        ),
      });
      setHeroEditing(false);
      setHeroDraft(null);
    } catch (e) {
      setHeroError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setHeroSaving(false);
    }
  }, [heroDraft, leadSources, patchLead]);

  const heroPhoneFeedbackId = `${heroFormId}-phone-feedback`;
  const heroPhoneInvalid = Boolean(heroPhoneFieldError);
  const heroNationalHint = heroDraft
    ? (optionForCountry(heroDraft.country)?.nationalHint ?? "Local number")
    : "Local number";

  const badgeClass =
    lead.rowTone === "interested"
      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
      : lead.rowTone === "not_interested"
        ? "bg-red-50 text-red-800 ring-1 ring-red-100"
        : lead.rowTone === "followup_later"
          ? "bg-amber-50 text-amber-900 ring-1 ring-amber-100"
          : "bg-sky-50 text-sky-900 ring-1 ring-sky-100";

  const sheetTabLabel =
    lead.sheetTab === "today"
      ? "Today's Data"
      : lead.sheetTab === "ongoing"
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
              Lead workspace ·{" "}
              <span className="tabular-nums">ID {lead.id}</span>
            </span>
          </div>

          <div className={SX.studentHeroBody}>
            <div className={SX.studentHeroTitleRow}>
              {heroEditing && heroDraft ? (
                <input
                  className={cn(
                    SX.studentHeroName,
                    "min-w-0 max-w-full flex-1 border border-slate-200 bg-white px-2 py-1.5 sm:max-w-[min(100%,36rem)]",
                  )}
                  value={heroDraft.studentName}
                  onChange={(e) =>
                    setHeroDraft({ ...heroDraft, studentName: e.target.value })
                  }
                  aria-label="Student name"
                  autoComplete="name"
                />
              ) : (
                <h1 className={SX.studentHeroName}>{lead.studentName}</h1>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                    badgeClass,
                  )}
                >
                  {extras.statusLabel}
                </span>
                {heroEditing ? (
                  <>
                    <button
                      type="button"
                      className={SX.btnSecondary}
                      disabled={heroSaving}
                      onClick={cancelHeroEdit}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={SX.btnPrimary}
                      disabled={heroSaving}
                      onClick={() => void saveHeroEdit()}
                    >
                      {heroSaving ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={cn(
                      SX.btnSecondary,
                      "inline-flex items-center gap-1.5",
                    )}
                    onClick={beginHeroEdit}
                  >
                    <IconPencil className="h-3.5 w-3.5 shrink-0" />
                    Edit details
                  </button>
                )}
              </div>
            </div>

            {heroEditing && heroDraft ? (
              <div
                className="mt-5 space-y-4 border-t border-slate-100 pt-5"
                role="group"
                aria-label="Edit student details"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Country
                    <select
                      className={cn(HERO_EDIT_INPUT, "mt-1 cursor-pointer")}
                      value={heroDraft.country}
                      onChange={(e) => {
                        const next = e.target.value;
                        setHeroError(null);
                        setHeroDraft({
                          ...heroDraft,
                          country: next,
                          dialCode: dialCodeForCountry(next),
                        });
                      }}
                    >
                      {LEAD_COUNTRY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.value} ({c.dialCode})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Lead date
                    <input
                      type="date"
                      className={cn(HERO_EDIT_INPUT, "mt-1 tabular-nums")}
                      value={heroDraft.date}
                      onChange={(e) =>
                        setHeroDraft({ ...heroDraft, date: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  <span id={`${heroFormId}-phone-label`}>Phone</span>
                  <div
                    className={cn(
                      "mt-1 flex w-full min-w-0 flex-nowrap items-stretch gap-2",
                      heroPhoneInvalid &&
                        "[&_input]:border-rose-400 [&_input]:focus:border-rose-500 [&_input]:focus:ring-rose-200/80",
                    )}
                    role="group"
                    aria-labelledby={`${heroFormId}-phone-label`}
                    aria-describedby={heroPhoneFeedbackId}
                    aria-invalid={heroPhoneInvalid}
                  >
                    <label className="sr-only" htmlFor={`${heroFormId}-dial`}>
                      Country code
                    </label>
                    <input
                      id={`${heroFormId}-dial`}
                      className={cn(
                        HERO_EDIT_INPUT,
                        "mt-0 w-[4.25rem] shrink-0 tabular-nums sm:w-20",
                      )}
                      value={heroDraft.dialCode}
                      onChange={(e) => {
                        setHeroError(null);
                        setHeroDraft({
                          ...heroDraft,
                          dialCode: normalizeDialCodeInput(e.target.value),
                        });
                      }}
                      onBlur={() =>
                        setHeroDraft((d) =>
                          d
                            ? {
                                ...d,
                                dialCode: normalizeDialCodeInput(d.dialCode),
                              }
                            : d,
                        )
                      }
                      placeholder="+91"
                      inputMode="tel"
                      autoComplete="tel-country-code"
                      aria-invalid={heroPhoneInvalid}
                    />
                    <div className="min-w-0 flex-1">
                      <label
                        className="sr-only"
                        htmlFor={`${heroFormId}-national`}
                      >
                        Mobile number
                      </label>
                      <input
                        id={`${heroFormId}-national`}
                        className={cn(
                          HERO_EDIT_INPUT,
                          "mt-0 w-full min-w-0 tabular-nums",
                        )}
                        value={heroDraft.nationalNumber}
                        onChange={(e) => {
                          setHeroError(null);
                          setHeroDraft({
                            ...heroDraft,
                            nationalNumber: digitsOnly(e.target.value),
                          });
                        }}
                        onFocus={() => {
                          setHeroError(null);
                          setHeroNationalFocused(true);
                        }}
                        onBlur={() => {
                          setHeroNationalFocused(false);
                          setHeroNationalBlurredOnce(true);
                        }}
                        placeholder={heroNationalHint}
                        inputMode="numeric"
                        autoComplete="tel-national"
                        aria-invalid={heroPhoneInvalid}
                        aria-errormessage={
                          heroPhoneFieldError ? heroPhoneFeedbackId : undefined
                        }
                      />
                    </div>
                  </div>
                  <p
                    id={heroPhoneFeedbackId}
                    className={cn(
                      "mt-1 text-[11px]",
                      heroPhoneFieldError ? "text-rose-700" : "text-slate-500",
                    )}
                    role={heroPhoneFieldError ? "alert" : undefined}
                    aria-live={heroPhoneFieldError ? "polite" : undefined}
                  >
                    {heroPhoneFieldError ?? `Expected: ${heroNationalHint}.`}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-x-8">
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Parent / guardian
                    <input
                      className={cn(HERO_EDIT_INPUT, "mt-1")}
                      value={heroDraft.parentName}
                      onChange={(e) =>
                        setHeroDraft({
                          ...heroDraft,
                          parentName: e.target.value,
                        })
                      }
                      placeholder="Optional"
                      autoComplete="name"
                    />
                  </label>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Email
                    <input
                      type="email"
                      className={cn(HERO_EDIT_INPUT, "mt-1")}
                      value={heroDraft.email}
                      onChange={(e) =>
                        setHeroDraft({ ...heroDraft, email: e.target.value })
                      }
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </label>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Grade / class
                    <select
                      className={cn(HERO_EDIT_INPUT, "mt-1 cursor-pointer")}
                      value={heroDraft.grade}
                      onChange={(e) =>
                        setHeroDraft({ ...heroDraft, grade: e.target.value })
                      }
                    >
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Source
                    <select
                      className={cn(HERO_EDIT_INPUT, "mt-0.5 cursor-pointer")}
                      value={heroDraft.dataType}
                      onChange={(e) =>
                        setHeroDraft({ ...heroDraft, dataType: e.target.value })
                      }
                      aria-label="Lead source"
                    >
                      {leadSources.map((o) => (
                        <option key={`${o.abbrev}-${o.value}`} value={o.value}>
                          {o.abbrev} — {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <fieldset className="min-w-0 border border-slate-200 p-2.5">
                  <legend className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Target exams
                  </legend>
                  <p className="mb-1.5 text-[11px] text-slate-500">
                    Select one or more.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {heroExamChoiceValues.map((exam) => (
                      <label
                        key={exam}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={heroDraft.targetExams.includes(exam)}
                          onChange={() => {
                            setHeroDraft((d) => {
                              if (!d) return d;
                              const has = d.targetExams.includes(exam);
                              const next = has
                                ? d.targetExams.filter((x) => x !== exam)
                                : [...d.targetExams, exam];
                              return {
                                ...d,
                                targetExams: next.length ? next : d.targetExams,
                              };
                            });
                          }}
                          className="rounded border-slate-300"
                        />
                        {targetExamLabelFor(exam)}
                      </label>
                    ))}
                  </div>
                </fieldset>

                {heroError ? (
                  <p className="text-[12px] text-rose-700" role="alert">
                    {heroError}
                  </p>
                ) : null}
              </div>
            ) : (
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
                      <span>{formatLeadPhone(lead)}</span>
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
                      {formatTargetExamsLabeled(lead.targetExams)}
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
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Grade
                  </dt>
                  <dd className="mt-1 text-[13px] font-medium text-slate-900">
                    {lead.grade}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Source
                  </dt>
                  <dd className="mt-1 text-[13px] font-medium text-slate-900">
                    {lead.dataType}
                  </dd>
                </div>
              </dl>
            )}

            {lead.sheetTab === "not_interested" &&
            lead.notInterestedRemark?.trim() ? (
              <div
                className="mt-4 rounded-none border border-rose-100 bg-rose-50/70 px-3 py-2.5"
                role="note"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-900/90">
                  Not interested remark
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-800">
                  {lead.notInterestedRemark.trim()}
                </p>
              </div>
            ) : null}

            <div className={SX.studentHeroSubline}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {!heroEditing ? (
                  <>
                    <span>
                      <span className={SX.studentHeroSubLabel}>Parent</span>{" "}
                      <span className={SX.studentHeroSubVal}>
                        {lead.parentName || "—"}
                      </span>
                    </span>
                    <span
                      className="hidden h-3 w-px bg-slate-200 sm:inline-block"
                      aria-hidden
                    />
                  </>
                ) : null}
                <span>
                  <span className={SX.studentHeroSubLabel}>Sheet</span>{" "}
                  <span className={SX.studentHeroSubVal}>{sheetTabLabel}</span>
                </span>
                <span
                  className="hidden h-3 w-px bg-slate-200 sm:inline-block"
                  aria-hidden
                />
                <span>
                  <span className={SX.studentHeroSubLabel}>Pipeline</span>{" "}
                  <span className={SX.studentHeroSubVal}>
                    {pipeDone}/{PIPELINE_TOTAL}
                  </span>
                </span>
              </div>
              {!heroEditing ? (
                <p className="mt-2">
                  <span className={SX.studentHeroSubLabel}>Email</span>{" "}
                  <span className={SX.studentHeroSubVal} title={extras.email}>
                    {extras.email}
                  </span>
                </p>
              ) : null}
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
            {activeStep === 1 && (
              <DemoStepPanel
                lead={lead}
                onPatchLead={patchLead}
                refreshLead={refreshLead}
                labelForTargetExam={targetExamLabelFor}
                canonicalTargetExams={targetExamActiveValues}
              />
            )}
            {activeStep === 2 && <DocumentsStepPanel lead={lead} />}
            {activeStep === 3 && <FeesStepPanel lead={lead} />}
            {activeStep === 4 && <ScheduleStepPanel lead={lead} />}
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
                <li
                  key={`${c.at}-${i}`}
                  className="flex flex-col gap-1 py-3 first:pt-0"
                >
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
                    <p className="text-[11px] text-slate-500">
                      Duration: {c.duration}
                    </p>
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
            No activity yet. Completing pipeline steps and saving notes will
            appear here.
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
          title={`Status: ${doneCount} of ${PIPELINE_TOTAL} onboarding steps completed`}
        >
          <p className="min-w-0 text-[11px] leading-tight text-slate-600 sm:text-right sm:text-xs">
            <span className="sr-only">Pipeline status: </span>
            <span className="font-semibold text-slate-900">Status</span>
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
        className="max-w-[min(100%,240px)] truncate text-center text-[11px] text-[#78909c]"
        title={
          !canNext && activeStep < PIPELINE_TOTAL
            ? activeStep === 1
              ? "Mark at least one demo as Completed before Documents."
              : "Complete this step before continuing."
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
