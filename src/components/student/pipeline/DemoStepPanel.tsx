"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import type { Faculty } from "@/lib/types";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import type { ExamSubjectEntry } from "@/lib/examSubjectTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { useExamSubjectCatalog } from "@/hooks/useExamSubjectCatalog";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import { parseIstSlot, getMeetHoldDurationMinutes } from "@/lib/meetLinks/window";
import { suggestNextFutureIstSlot } from "@/lib/demoSchedule/suggestNextFutureIstSlot";
import { defaultTimeZoneForCountry } from "@/lib/timezones/countryDefaultTimeZone";
import {
  getGroupedTimeZoneSelectOptions,
  ensureSelectedTimeZoneOption,
} from "@/lib/timezones/ianaTimeZones";
import { randomUuid } from "@/lib/randomUuid";
import { isTeacherFeedbackEligible } from "@/lib/demoFeedback/eligibility";
import { getTeacherBlockDurationMinutes } from "@/lib/demoSchedule/durations";
import { getDemoAutoCompleteAfterMinutes } from "@/lib/demoSchedule/durations";
import { getDemoTeacherFeedbackAfterMinutes } from "@/lib/demoFeedback/config";
import { PipelineStepFrame } from "./PipelineStepFrame";
import { PipelineMessageDialog } from "./PipelineMessageDialog";
import type { DemoStepPanelProps } from "./pipelineStepTypes";
import {
  IconCheck,
  IconCalendarLarge,
  IconPencil,
} from "@/components/icons/CrmIcons";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";

function formatTime12hInZone(d: Date, timeZone: string): string {
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return s.replace(/\b(AM|PM)\b/g, (x) => x.toLowerCase());
}

function formatDateInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatIsoDateInZone(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

function timeZoneShortLabel(tz: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(at);
    const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return name || tz;
  } catch {
    return tz;
  }
}

function teachersForSubject(
  faculties: Faculty[],
  exam: string,
  subjectName: string,
  catalog: ExamSubjectEntry[],
): Faculty[] {
  const slug = subjectName.trim().toLowerCase();
  const subjectIds = catalog
    .filter(
      (e) =>
        e.examValue === exam &&
        e.name.trim().toLowerCase() === slug &&
        e.isActive !== false,
    )
    .map((e) => e.id);
  const matched: Faculty[] = [];
  for (const f of faculties) {
    if (!f.active) continue;
    for (const a of f.assignments ?? []) {
      if (a.examValue !== exam) continue;
      if (subjectIds.includes(a.subjectId)) {
        matched.push(f);
        break;
      }
    }
  }
  if (matched.length > 0) return matched;
  for (const f of faculties) {
    if (!f.active) continue;
    const subs = f.subjects ?? [];
    if (!subs.some((x) => String(x).trim().toLowerCase() === slug)) continue;
    if (f.courses?.length && !f.courses.includes(exam)) continue;
    matched.push(f);
  }
  return matched;
}

/** Rich message for modal when slot is in the past (IST + student zone). */
function validateScheduleSlotDetailed(
  isoDate: string,
  timeHmIST: string,
  studentTz: string,
): string | null {
  const slot = parseIstSlot(isoDate, timeHmIST);
  if (!slot) return "Enter a valid date and time.";
  if (slot.getTime() >= Date.now()) return null;
  const istLine = `${format(slot, "d MMM yyyy")}, ${formatTime12hInZone(slot, "Asia/Kolkata")} IST`;
  const tz = studentTz?.trim() || "Asia/Kolkata";
  const stuLine = `${formatDateInZone(slot, tz)} · ${formatTime12hInZone(slot, tz)} ${timeZoneShortLabel(tz, slot)}`;
  return `This demo time is already in the past — it cannot be created. Checked in India (IST) and in the student timezone.\n\nIndia: ${istLine}.\nStudent (${tz}): ${stuLine}.\n\nChoose a later time or a future date.`;
}

const STATUS_OPTIONS = ["Scheduled", "Completed", "Cancelled"] as const;

/** Row text + tint from demo status (scheduled = orange, conducted = green, cancelled = red). */
/** Table body cells: no fixed text color so status row tint + `text-*` on `<tr>` apply. */
const DEMO_TABLE_TD =
  "border border-slate-200 px-2 py-1.5 align-middle text-[11px] sm:text-[12px] min-w-0 text-inherit";

function demoStatusRowClasses(status: string | undefined): {
  text: string;
  cellBg: string;
  cellBorder: string;
} {
  const s = String(status ?? "Scheduled").trim();
  if (s === "Cancelled") {
    return {
      text: "!text-red-900",
      cellBg: "[&>td]:!bg-red-50/85",
      cellBorder: "[&>td]:!border-red-200/80",
    };
  }
  if (s === "Completed") {
    return {
      text: "!text-emerald-900",
      cellBg: "[&>td]:!bg-emerald-50/80",
      cellBorder: "[&>td]:!border-emerald-200/70",
    };
  }
  return {
    text: "!text-orange-900",
    cellBg: "[&>td]:!bg-orange-50/85",
    cellBorder: "[&>td]:!border-orange-200/80",
  };
}

function istWhenLines(isoDate: string, timeHmIST: string): { date: string; time: string } | null {
  const slot = parseIstSlot(isoDate, timeHmIST);
  if (!slot) return null;
  return {
    date: format(slot, "d MMM yyyy"),
    time: `${formatTime12hInZone(slot, "Asia/Kolkata")} IST`,
  };
}

function studentWhenLines(
  isoDate: string,
  timeHmIST: string,
  studentTz: string | undefined,
): { date: string; time: string } | null {
  const slot = parseIstSlot(isoDate, timeHmIST);
  if (!slot || !studentTz?.trim()) return null;
  const tz = studentTz.trim();
  return {
    date: formatDateInZone(slot, tz),
    time: `${formatTime12hInZone(slot, tz)} ${timeZoneShortLabel(tz, slot)}`,
  };
}

function isDemoTimeReached(isoDate: string, timeHmIST: string): boolean {
  const slot = parseIstSlot(isoDate, timeHmIST);
  if (!slot) return false;
  return slot.getTime() <= Date.now();
}

function demoInviteHighlight(row: DemoTableRowPersisted): string {
  if (!row.isoDate || !row.timeHmIST) {
    return `${row.subject || "Demo"} · ${row.teacher || "—"}`;
  }
  const ist = istWhenLines(row.isoDate, row.timeHmIST);
  const line = ist ? `${ist.date} · ${ist.time}` : "—";
  return `${row.subject || "Demo"} · ${row.teacher || "—"} · ${line}`;
}

function demoDetailsFormat(row: DemoTableRowPersisted, lead: Lead): string {
  if (!row.isoDate || !row.timeHmIST) {
    return `Student Name: ${lead.studentName}\nExam:               —\nClass:               —\nSubject:            —\nDemo Time:     —\nFaculty:            —\nDemo Link:      —`;
  }
  const ist = istWhenLines(row.isoDate, row.timeHmIST);
  const line = ist ? `${ist.date} · ${ist.time}` : "—";
  
  // Get exam from lead's targetExams
  const exam = lead.targetExams?.[0] || "—";
  
  return `Student Name: ${lead.studentName}\nExam:               ${exam}\nClass:               ${lead.grade}\nSubject:            ${row.subject}\nDemo Time:     ${row.isoDate} - ${row.timeHmIST}\nFaculty:            ${row.teacher}\nDemo Link:      Attached`;
}

function leadContactMeta(lead: Lead): string {
  const name = lead.studentName?.trim() || "Student";
  const phone = lead.phone?.trim() || "—";
  const email = (lead.parentEmail?.trim() || lead.email?.trim() || "—").toUpperCase();
  return `${name} · ${phone}\nEmail: ${email}`;
}

function pickDefaultExamForLead(lead: Lead, examChoices: string[]): string {
  for (const raw of lead.targetExams ?? []) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t && examChoices.includes(t)) return t;
  }
  return examChoices[0] ?? "";
}

export function DemoStepPanel({
  lead,
  onPatchLead,
  refreshLead,
  labelForTargetExam,
  canonicalTargetExams,
}: DemoStepPanelProps) {
  const { subjects: catalogSubjects, byExam: subjectsByExam } =
    useExamSubjectCatalog();
  const [faculties, setFaculties] = useState<Faculty[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/faculties", { cache: "no-store" })
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

  const examChoices = useMemo(() => {
    const set = new Set<string>();
    for (const v of canonicalTargetExams) set.add(v);
    for (const v of lead.targetExams) {
      const t = typeof v === "string" ? v.trim() : "";
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [canonicalTargetExams, lead.targetExams]);

  const rows: DemoTableRowPersisted[] = useMemo(() => {
    const demo = lead.pipelineMeta?.demo as { rows?: DemoTableRowPersisted[] } | undefined;
    return Array.isArray(demo?.rows) ? [...demo!.rows!] : [];
  }, [lead.pipelineMeta]);

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [editingMeetRowId, setEditingMeetRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** While a row status PATCH is in flight — avoids acting on stale row data. */
  const [statusSavingMeetId, setStatusSavingMeetId] = useState<string | null>(null);
  const autoFeedbackEmailSentRef = useRef<Set<string>>(new Set());

  type DemoMessageDialogState =
    | { open: false }
    | {
        open: true;
        mode: "alert";
        variant: "default" | "error";
        title: string;
        description: string;
        highlight?: string | Record<string, string>;
        meta?: string | Record<string, string>;
        okLabel?: string;
      }
    | {
        open: true;
        mode: "confirm";
        variant: "default" | "error";
        title: string;
        description: string;
        highlight?: string | Record<string, string>;
        meta?: string | Record<string, string>;
        confirmLabel: string;
        cancelLabel?: string;
        onConfirm: () => void;
        loading?: boolean;
      };
  const [msgDlg, setMsgDlg] = useState<DemoMessageDialogState>({ open: false });
  const closeMsgDlg = () => setMsgDlg({ open: false });
  const [cancelDemoDialog, setCancelDemoDialog] = useState<{
    open: boolean;
    row: DemoTableRowPersisted | null;
    notifyParent: boolean;
    notifyFaculty: boolean;
    loading: boolean;
  }>({
    open: false,
    row: null,
    notifyParent: true,
    notifyFaculty: true,
    loading: false,
  });

  const [examDraft, setExamDraft] = useState("");
  const [subjectDraft, setSubjectDraft] = useState("");
  const [teacherDraft, setTeacherDraft] = useState("");
  const [isoDate, setIsoDate] = useState(() => suggestNextFutureIstSlot().isoDate);
  const [timeHmIST, setTimeHmIST] = useState(() => suggestNextFutureIstSlot().timeHmIST);
  const [studentTz, setStudentTz] = useState(() =>
    defaultTimeZoneForCountry(lead.country ?? ""),
  );

  const subjectsForExam = useMemo(() => {
    const list = subjectsByExam.get(examDraft.trim()) ?? [];
    return list
      .filter((e) => e.isActive !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [examDraft, subjectsByExam]);

  const teacherPool = useMemo(() => {
    if (!examDraft || !subjectDraft.trim()) return [];
    return teachersForSubject(
      faculties,
      examDraft,
      subjectDraft,
      catalogSubjects,
    );
  }, [examDraft, subjectDraft, faculties, catalogSubjects]);

  const previewStudent = useMemo(() => {
    const slot = parseIstSlot(isoDate, timeHmIST);
    if (!slot) return "";
    return `${formatDateInZone(slot, studentTz)} · ${formatTime12hInZone(slot, studentTz)} ${timeZoneShortLabel(studentTz, slot)}`;
  }, [isoDate, timeHmIST, studentTz]);

  const timeZoneOptions = useMemo(() => {
    const base = getGroupedTimeZoneSelectOptions();
    return ensureSelectedTimeZoneOption(studentTz, base);
  }, [studentTz]);

  const timeZoneGroups = useMemo(() => {
    const g = [...new Set(timeZoneOptions.map((o) => o.group))];
    return g.sort((a, b) => a.localeCompare(b));
  }, [timeZoneOptions]);
  const minDemoIsoDate = useMemo(
    () => formatIsoDateInZone(new Date(), "Asia/Kolkata"),
    [],
  );

  const openNew = () => {
    setEditingMeetRowId(null);
    const ex = pickDefaultExamForLead(lead, examChoices);
    const list = (subjectsByExam.get(ex) ?? [])
      .filter((e) => e.isActive !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const firstSubj = list[0]?.name ?? "";
    const pool = firstSubj
      ? teachersForSubject(faculties, ex, firstSubj, catalogSubjects)
      : [];
    const firstTeacher = pool[0]?.name ?? "";
    const slot = suggestNextFutureIstSlot();
    setExamDraft(ex);
    setSubjectDraft(firstSubj);
    setTeacherDraft(firstTeacher);
    setIsoDate(slot.isoDate);
    setTimeHmIST(slot.timeHmIST);
    setStudentTz(defaultTimeZoneForCountry(lead.country ?? ""));
    setScheduleFormOpen(true);
  };

  const openEdit = (row: DemoTableRowPersisted) => {
    setEditingMeetRowId(row.meetRowId ?? "");
    setExamDraft(row.examValue?.trim() || examChoices[0] || "");
    setSubjectDraft(row.subject ?? "");
    setTeacherDraft(row.teacher ?? "");
    setIsoDate(row.isoDate || format(new Date(), "yyyy-MM-dd"));
    setTimeHmIST(row.timeHmIST || "10:00");
    setStudentTz(
      row.studentTimeZone?.trim() ||
        defaultTimeZoneForCountry(lead.country ?? ""),
    );
    setScheduleFormOpen(true);
  };

  const persistDemoRows = async (
    nextRows: DemoTableRowPersisted[],
    activity?: { kind: "demo"; message: string },
  ) => {
    const merged = mergePipelineMeta(lead.pipelineMeta, {
      demo: { rows: nextRows },
    }) as Lead["pipelineMeta"];
    await onPatchLead({
      pipelineMeta: merged,
      ...(activity
        ? { activityLog: appendActivity(lead.activityLog, activity.kind, activity.message) }
        : {}),
    });
  };

  const updateRowStatus = async (
    meetRowId: string,
    status: string,
    notify: { notifyParent?: boolean; notifyFaculty?: boolean } = {},
  ) => {
    setStatusSavingMeetId(meetRowId);
    try {
      const current = rows.find((r) => String(r.meetRowId) === meetRowId);
      if (
        status === "Completed" &&
        (!current ||
          !current.isoDate ||
          !current.timeHmIST ||
          !isDemoTimeReached(current.isoDate, current.timeHmIST))
      ) {
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "Cannot mark as conducted yet",
          description:
            "You can mark a demo as conducted only at or after its scheduled date and time.",
        });
        return;
      }
      const next = rows.map((r) =>
        String(r.meetRowId) === meetRowId ? { ...r, status } : r,
      );
      await persistDemoRows(next, {
        kind: "demo",
        message: `Demo status set to ${status} (${meetRowId.slice(0, 8)}…).`,
      });
      await refreshLead();
      const idx = next.findIndex((r) => String(r.meetRowId) === meetRowId);
      if (idx < 0) return;
      const st = status as "Scheduled" | "Completed" | "Cancelled";
      if (st !== "Scheduled" && st !== "Completed" && st !== "Cancelled") return;
      const notifyParent = notify.notifyParent !== false;
      const notifyFaculty = notify.notifyFaculty === true;
      if (!notifyParent && !notifyFaculty) return;
      const rowSnap = next[idx] as unknown as Record<string, unknown>;
      try {
        await sendLeadPipelineEmail(lead.id, {
          templateKey: "demo_status_update",
          demoRowIndex: idx,
          meetRowId,
          demoStatusEmail: {
            status: st,
            row: rowSnap,
            notifyParent,
            notifyFaculty,
          },
        });
      } catch (e) {
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "Status email not sent",
          description:
            e instanceof Error
              ? `${e.message}\n\nStatus was saved. Fix recipient emails, SMTP, or the demo status template, then try again if needed.`
              : "Status email could not be sent. Status was still saved.",
        });
      }
    } finally {
      setStatusSavingMeetId(null);
    }
  };

  const submitModal = async (confirmShared?: boolean) => {
    const ex = examDraft.trim();
    const subj = subjectDraft.trim();
    const teach = teacherDraft.trim();
    if (!ex || !subj || !teach) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Cannot schedule demo",
        description: "Exam, subject, and teacher are all required before saving.",
      });
      return;
    }
    const pastMsg = validateScheduleSlotDetailed(isoDate, timeHmIST, studentTz);
    if (pastMsg) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Cannot schedule demo",
        description: pastMsg,
      });
      return;
    }
    setSaving(true);
    try {
      const meetRowId = editingMeetRowId ?? randomUuid();
      let nextRows: DemoTableRowPersisted[];
      if (editingMeetRowId) {
        await fetch("/api/meet-links/bookings/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId: lead.id, meetRowId }),
        }).catch(() => {});

        nextRows = rows.map((r) =>
          String(r.meetRowId) === editingMeetRowId
            ? {
                ...r,
                examValue: ex,
                subject: subj,
                teacher: teach,
                studentTimeZone: studentTz,
                isoDate,
                timeHmIST,
                status: r.status === "Cancelled" ? "Scheduled" : r.status,
              }
            : r,
        );
        await persistDemoRows(nextRows, {
          kind: "demo",
          message: `Demo updated: ${subj} · ${teach} · ${isoDate} ${timeHmIST} IST`,
        });
      } else {
        nextRows = [...rows];
      }

      const assignRes = await fetch("/api/meet-links/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          meetRowId,
          isoDate,
          timeHmIST,
          subject: subj,
          teacher: teach,
          confirmSharedTeacherSlot: confirmShared === true,
        }),
      });
      const assignData = (await assignRes.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        meetLinkUrl?: string;
        meetBookingId?: string;
        meetWindowStartIso?: string;
        meetWindowEndIso?: string;
      };

      if (!assignRes.ok) {
        if (assignData.code === "teacher_busy_joinable" && !confirmShared) {
          setSaving(false);
          setMsgDlg({
            open: true,
            mode: "confirm",
            variant: "default",
            title: "Share this Meet link?",
            description:
              (assignData.error ?? "This teacher already has a student in this slot.") +
              "\n\nUse the same Google Meet as the other student in this slot?",
            highlight: `${subj} · ${teach} · ${isoDate} ${timeHmIST} IST`,
            confirmLabel: "Share & continue",
            cancelLabel: "Cancel",
            loading: false,
            onConfirm: async () => {
              setMsgDlg((prev) => ({ ...prev, loading: true }));
              await submitModal(true);
            },
          });
          return;
        }
        if (!editingMeetRowId) {
          // New schedule failed: do not leave a ghost row in the table.
          await refreshLead();
        }
        setSaving(false);
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "Could not reserve Meet",
          description: assignData.error || "Could not reserve Meet link.",
        });
        await refreshLead();
        return;
      }

      const link = String(assignData.meetLinkUrl ?? "").trim();
      const baseRows =
        editingMeetRowId
          ? nextRows
          : [
              ...rows,
              {
                examValue: ex,
                subject: subj,
                teacher: teach,
                studentTimeZone: studentTz,
                status: "Scheduled",
                isoDate,
                timeHmIST,
                meetRowId,
                meetLinkUrl: "",
                meetBookingId: "",
                meetWindowStartIso: "",
                meetWindowEndIso: "",
              },
            ];
      const patched = baseRows.map((r) =>
        String(r.meetRowId) === meetRowId
          ? {
              ...r,
              meetLinkUrl: link,
              meetBookingId: assignData.meetBookingId ?? "",
              meetWindowStartIso: assignData.meetWindowStartIso ?? "",
              meetWindowEndIso: assignData.meetWindowEndIso ?? "",
            }
          : r,
      );
      await persistDemoRows(patched, {
        kind: "demo",
        message: `Demo scheduled: ${subj} · ${teach} · ${isoDate} ${timeHmIST} IST`,
      });
      setScheduleFormOpen(false);
      await refreshLead();
      
      // Format demo details as structured object
      const ist = istWhenLines(isoDate, timeHmIST);
      const formattedDate = ist ? ist.date : "—";
      const formattedTime = ist ? ist.time : "—";
      const demoDetails = {
        "Student Name": lead.studentName,
        "Exam": ex,
        "Class": lead.grade,
        "Subject": subj,
        "Demo Time": `${formattedDate} - ${formattedTime}`,
        "Faculty": teach,
        "Demo Link": "Attached"
      };
      
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "default",
        title: editingMeetRowId ? "Demo updated" : "Demo Details",
        description:
          "The trial class was saved and the Google Meet link is attached to this lead.",
        highlight: demoDetails,
        okLabel: "Confirm Demo Details",
      });
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Save failed",
        description: e instanceof Error ? e.message : "Something went wrong while saving.",
      });
    } finally {
      setSaving(false);
    }
  };

  const sendDemoInviteEmail = (row: DemoTableRowPersisted, isResend: boolean) => {
    const meetRowId = String(row.meetRowId ?? "");
    if (!meetRowId) return;
    
    // Format demo details as structured object
    const ist = row.isoDate && row.timeHmIST ? istWhenLines(row.isoDate, row.timeHmIST) : null;
    const formattedDate = ist ? ist.date : "—";
    const formattedTime = ist ? ist.time : "—";
    const exam = lead.targetExams?.[0] || "—";
    
    const demoDetails = {
      "Student Name": lead.studentName,
      "Exam": exam,
      "Class": lead.grade,
      "Subject": row.subject,
      "Demo Time": `${formattedDate} - ${formattedTime}`,
      "Faculty": row.teacher,
      "Demo Link": "Attached"
    };
    
    const studentDetails = {
      "Name": lead.studentName,
      "Phone": lead.phone || "—",
      "Email": (lead.parentEmail || lead.email || "—").toUpperCase()
    };
    
    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: isResend ? "Confirm demo & resend link" : "Confirm demo & send link",
      description: isResend
        ? "Send the demo join link to parent/student again. Faculty will be notified through a separate flow."
        : "Send the demo join link to parent/student. Faculty will be notified through a separate flow.",
      highlight: demoDetails,
      meta: studentDetails,
      confirmLabel: isResend
        ? "Confirm Demo & Send Link"
        : "Confirm Demo Details",
      cancelLabel: "Cancel",
      loading: false,
      onConfirm: async () => {
        setMsgDlg((prev) => ({ ...prev, loading: true }));
        try {
          const res = await fetch(
            `/api/leads/${encodeURIComponent(lead.id)}/send-email`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ templateKey: "demo_invite", meetRowId }),
            },
          );
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            throw new Error(data.error || "Could not send demo invite.");
          }
          await refreshLead();
          closeMsgDlg();
        } catch (e) {
          setMsgDlg({
            open: true,
            mode: "alert",
            variant: "error",
            title: "Could not send invite",
            description: e instanceof Error ? e.message : "Something went wrong.",
          });
        }
      },
    });
  };

  const sendTeacherFeedback = (meetRowId: string, isResend: boolean) => {
    // Find the demo row to check status and time
    const row = rows.find((r) => String(r.meetRowId) === meetRowId);
    if (!row) return;
    
    // Check if demo is Cancelled or Rescheduled
    if (row.status === "Cancelled" || row.status === "Rescheduled") {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Cannot send feedback",
        description: "Faculty feedback cannot be sent for cancelled or rescheduled demos.",
      });
      return;
    }
    
    // Check if 45 minutes have passed since the demo session time
    if (row.isoDate && row.timeHmIST) {
      const demoDateTime = new Date(`${row.isoDate}T${row.timeHmIST}:00+05:30`);
      const currentTime = new Date();
      const timeDiff = currentTime.getTime() - demoDateTime.getTime();
      const fortyFiveMinutes = 45 * 60 * 1000; // 45 minutes in milliseconds
      
      if (timeDiff < fortyFiveMinutes) {
        const remainingMinutes = Math.ceil((fortyFiveMinutes - timeDiff) / (60 * 1000));
        setMsgDlg({
          open: true,
          mode: "alert",
          variant: "error",
          title: "Cannot send feedback yet",
          description: `Faculty feedback can only be sent 45 minutes after the session time. Please wait ${remainingMinutes} more minutes.`,
        });
        return;
      }
    }
    
    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: isResend ? "Resend feedback email" : "Email teacher",
      description: isResend
        ? "Send the feedback email to the teacher again? The same link is reused until they submit the form once."
        : "Send a one-time feedback link to the teacher? The link stops working after they submit once.",
      confirmLabel: isResend ? "Resend email" : "Send email",
      cancelLabel: "Cancel",
      loading: false,
      onConfirm: async () => {
        setMsgDlg((prev) => ({ ...prev, loading: true }));
        try {
          const res = await fetch(
            `/api/leads/${encodeURIComponent(lead.id)}/demo-feedback`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meetRowId, sendEmail: true }),
            },
          );
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            feedbackUrl?: string;
          };
          if (!res.ok) {
            throw new Error(data.error || "Could not send feedback invite.");
          }
          if (data.feedbackUrl) {
            await navigator.clipboard.writeText(data.feedbackUrl).catch(() => {});
          }
          await refreshLead();
          setMsgDlg({
            open: true,
            mode: "alert",
            variant: "default",
            title: "Feedback email sent",
            description:
              "The teacher was emailed when their address is on file. The link was also copied to your clipboard when available.",
          });
        } catch (e) {
          setMsgDlg({
            open: true,
            mode: "alert",
            variant: "error",
            title: "Could not send",
            description: e instanceof Error ? e.message : "Something went wrong.",
          });
        }
      },
    });
  };

  const requestStatusChangeWithConfirm = (
    row: DemoTableRowPersisted,
    nextStatusRaw: string,
    canConductNow: boolean,
  ) => {
    const nextStatus = nextStatusRaw as "Scheduled" | "Completed" | "Cancelled";
    const currentStatus = String(row.status ?? "Scheduled").trim();
    if (
      nextStatus !== "Scheduled" &&
      nextStatus !== "Completed" &&
      nextStatus !== "Cancelled"
    ) {
      return;
    }
    if (nextStatus === currentStatus) return;
    const meetRowId = String(row.meetRowId ?? "").trim();
    if (!meetRowId) return;

    if (nextStatus === "Cancelled") {
      setCancelDemoDialog({
        open: true,
        row,
        notifyParent: true,
        notifyFaculty: true,
        loading: false,
      });
      return;
    }

    if (nextStatus === "Completed" && !canConductNow) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Cannot mark as conducted yet",
        description:
          "You can mark this demo as conducted only at or after its scheduled date and time.",
      });
      return;
    }

    setMsgDlg({
      open: true,
      mode: "confirm",
      variant: "default",
      title: "Confirm status change",
      description:
        nextStatus === "Completed"
          ? "Mark this demo as Conducted? Activity log and parent notification are created only after confirmation."
          : "Mark this demo as Scheduled? Activity log and parent notification are created only after confirmation.",
      highlight: demoInviteHighlight(row),
      confirmLabel:
        nextStatus === "Completed" ? "Confirm Conducted" : "Confirm Scheduled",
      cancelLabel: "Cancel",
      loading: false,
      onConfirm: async () => {
        setMsgDlg((prev) => ({ ...prev, loading: true }));
        await updateRowStatus(meetRowId, nextStatus, {
          notifyParent: true,
          notifyFaculty: false,
        });
        closeMsgDlg();
      },
    });
  };

  const closeCancelDemoDialog = () =>
    setCancelDemoDialog({
      open: false,
      row: null,
      notifyParent: true,
      notifyFaculty: true,
      loading: false,
    });

  const confirmCancelDemo = async () => {
    const row = cancelDemoDialog.row;
    if (!row) {
      closeCancelDemoDialog();
      return;
    }
    const meetRowId = String(row.meetRowId ?? "").trim();
    if (!meetRowId) {
      closeCancelDemoDialog();
      return;
    }
    setCancelDemoDialog((prev) => ({ ...prev, loading: true }));
    await updateRowStatus(meetRowId, "Cancelled", {
      notifyParent: cancelDemoDialog.notifyParent,
      notifyFaculty: cancelDemoDialog.notifyFaculty,
    });
    closeCancelDemoDialog();
  };

  useEffect(() => {
    if (!lead.id || rows.length === 0) return;
    for (const r of rows) {
      if (String(r.status ?? "") === "Cancelled") continue;
      if (r.teacherFeedbackSubmittedAt) continue;
      const rid = String(r.meetRowId ?? "");
      if (!rid) continue;
      if (
        !isTeacherFeedbackEligible(
          {
            status: r.status,
            isoDate: r.isoDate,
            timeHmIST: r.timeHmIST,
            teacherFeedbackSubmittedAt: r.teacherFeedbackSubmittedAt ?? null,
          },
          new Date(),
        )
      ) {
        continue;
      }
      if (r.teacherFeedbackInviteSentAt) continue;
      if (autoFeedbackEmailSentRef.current.has(rid)) continue;
      autoFeedbackEmailSentRef.current.add(rid);
      void (async () => {
        try {
          const res = await fetch(
            `/api/leads/${encodeURIComponent(lead.id)}/demo-feedback`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ meetRowId: rid, sendEmail: true }),
            },
          );
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) throw new Error(data.error || "Auto-send failed.");
          await refreshLead();
        } catch {
          autoFeedbackEmailSentRef.current.delete(rid);
        }
      })();
    }
  }, [lead.id, rows, refreshLead]);

  const copyTeacherFeedbackLink = async (meetRowId: string) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/demo-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetRowId, linkOnly: true }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        feedbackUrl?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not create feedback link.");
      if (data.feedbackUrl) {
        try {
          await navigator.clipboard.writeText(data.feedbackUrl);
          setMsgDlg({
            open: true,
            mode: "alert",
            variant: "default",
            title: "Link copied",
            description: "The teacher feedback link is on your clipboard.",
          });
        } catch {
          setMsgDlg({
            open: true,
            mode: "alert",
            variant: "error",
            title: "Copy failed",
            description:
              "The link was created but could not be copied automatically. Open this lead again and use Copy, or check browser permissions for the clipboard.",
            highlight: data.feedbackUrl,
          });
        }
      }
    } catch (e) {
      setMsgDlg({
        open: true,
        mode: "alert",
        variant: "error",
        title: "Could not copy link",
        description: e instanceof Error ? e.message : "Something went wrong.",
      });
    } finally {
      setSaving(false);
    }
  };

  const firstName = lead.studentName?.trim() || "Student";
  const conducted = rows.some((r) => r.status === "Completed");
  const tb = getTeacherBlockDurationMinutes();
  const mh = getMeetHoldDurationMinutes();
  const ac = getDemoAutoCompleteAfterMinutes();
  const fb = getDemoTeacherFeedbackAfterMinutes();

  return (
    <PipelineStepFrame stepNumber={1} leadId={lead.id}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className={SX.sectionTitle}>
                  Step 1 — {firstName}&apos;s demo
                </h2>
                {conducted ? (
                  <span className="rounded-none bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 ring-1 ring-emerald-200">
                    Done
                  </span>
                ) : (
                  <span className="rounded-none bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200">
                    Pending
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-3xl text-[13px] leading-snug text-slate-600">
                Schedule and manage {firstName}&apos;s trial classes with clear
                status and quick actions. Mark at least one demo as{" "}
                <strong className="font-semibold text-slate-800">Completed</strong>{" "}
                before moving to Documents.
              </p>
            </div>
            {rows.length > 0 ? (
              <button
                type="button"
                className={SX.leadBtnGreen}
                disabled={saving || examChoices.length === 0}
                onClick={openNew}
              >
                + Add another demo
              </button>
            ) : null}
          </div>
        </div>

        {scheduleFormOpen ? (
          <div className="border-b border-slate-200 bg-slate-50/60 px-2 py-3 sm:px-4">
            <div className="mx-auto max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-[15px] font-bold text-slate-900">
                  {editingMeetRowId ? "Edit trial class" : "Schedule a trial class"}
                </h2>
                <p className="mt-1 text-[12px] leading-snug text-slate-600">
                  Schedule in IST (left). The student timezone (right) defaults for this
                  lead&apos;s country. Pick any IANA zone from the list; override anytime. See
                  sidebar:{" "}
                  <a href="/time-zones" className="text-primary underline">
                    Time zones
                  </a>{" "}
                  for country → default mapping.
                </p>
              </div>
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(120px,160px)_1fr]">
                  <div className="flex items-center border-b border-slate-200 bg-slate-100 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-700 sm:border-b-0 sm:border-r sm:border-slate-200">
                    Exam &amp; subject
                  </div>
                  <div className="space-y-2 p-3 sm:p-4">
                    <select
                      className={cn(SX.select, "w-full")}
                      value={examDraft}
                      onChange={(e) => {
                        const next = e.target.value;
                        setExamDraft(next);
                        const list = (subjectsByExam.get(next) ?? [])
                          .filter((s) => s.isActive !== false)
                          .sort(
                            (a, b) =>
                              a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
                          );
                        const sub = list[0]?.name ?? "";
                        setSubjectDraft(sub);
                        const pool = sub
                          ? teachersForSubject(
                              faculties,
                              next,
                              sub,
                              catalogSubjects,
                            )
                          : [];
                        setTeacherDraft(pool[0]?.name ?? "");
                      }}
                    >
                      {examChoices.map((e) => (
                        <option key={e} value={e}>
                          {labelForTargetExam(e)}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-1.5">
                      {subjectsForExam.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSubjectDraft(s.name);
                            const pool = teachersForSubject(
                              faculties,
                              examDraft,
                              s.name,
                              catalogSubjects,
                            );
                            setTeacherDraft(pool[0]?.name ?? "");
                          }}
                          className={cn(
                            "rounded-none border px-2.5 py-1 text-[12px] font-medium transition-colors",
                            subjectDraft === s.name
                              ? "border-primary bg-sky-50 text-primary ring-1 ring-primary/25"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(120px,160px)_1fr]">
                  <div className="flex items-center border-b border-slate-200 bg-slate-100 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-700 sm:border-b-0 sm:border-r sm:border-slate-200">
                    Teacher
                  </div>
                  <div className="p-3 sm:p-4">
                    <select
                      className={cn(SX.select, "w-full")}
                      value={teacherDraft}
                      onChange={(e) => setTeacherDraft(e.target.value)}
                    >
                      <option value="">Select teacher</option>
                      {teacherPool.map((f) => (
                        <option key={f.id} value={f.name}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(120px,160px)_1fr]">
                  <div className="flex items-center bg-slate-100 px-3 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-700 sm:border-r sm:border-slate-200">
                    When
                  </div>
                  <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        India (IST)
                      </span>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          className={cn(SX.input, "w-full max-w-44")}
                          value={isoDate}
                          min={!editingMeetRowId ? minDemoIsoDate || undefined : undefined}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (!editingMeetRowId && minDemoIsoDate && next < minDemoIsoDate) {
                              setIsoDate(minDemoIsoDate);
                              return;
                            }
                            setIsoDate(next);
                          }}
                        />
                        <span className="text-[11px] text-slate-500">at</span>
                        <input
                          type="time"
                          className={cn(SX.input, "w-26")}
                          value={timeHmIST}
                          onChange={(e) => setTimeHmIST(e.target.value)}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">IST</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Student timezone
                      </span>
                      <select
                        className={cn(SX.select, "mt-1 w-full text-[12px]")}
                        value={studentTz}
                        onChange={(e) => setStudentTz(e.target.value)}
                      >
                        {timeZoneGroups.map((group) => (
                          <optgroup key={group} label={group}>
                            {timeZoneOptions
                              .filter((o) => o.group === group)
                              .map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] font-semibold text-slate-800">
                        Preview: {previewStudent || "—"}
                      </p>
                      <p className="mt-1 text-[10px] leading-snug text-slate-500">
                        You can schedule for any local time. The slot must still be in the
                        future (checked in IST and the student timezone above).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                <button
                  type="button"
                  className={SX.btnSecondary}
                  disabled={saving}
                  onClick={() => !saving && setScheduleFormOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={SX.leadBtnGreen}
                  disabled={saving}
                  onClick={() => void submitModal()}
                >
                  {saving ? "Saving…" : "Schedule demo"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-1 py-2 sm:px-2">
          {!scheduleFormOpen && rows.length === 0 ? (
            <div className="mx-1 my-3 flex flex-col items-center sm:mx-2">
              <div
                className={cn(
                  "w-full max-w-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 py-11 text-center",
                  "shadow-none",
                )}
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center text-primary">
                  <IconCalendarLarge className="h-12 w-12" />
                </div>
                <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
                  No demo scheduled yet
                </h3>
                <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-600">
                  Use <span className="font-medium text-slate-800">Create demo</span> to add
                  date, time, and teacher. Everything stays in the table below.
                </p>
                <button
                  type="button"
                  className={cn(
                    "mt-6 inline-flex h-9 items-center justify-center rounded-none px-4 text-[13px] font-medium transition-colors",
                    "border border-primary bg-white text-primary hover:bg-sky-50/90",
                  )}
                  disabled={saving || examChoices.length === 0}
                  onClick={openNew}
                >
                  + Create demo
                </button>
              </div>
            </div>
          ) : rows.length > 0 ? (
            <div className="w-full min-w-0">
              <table
                className={cn(
                  SX.dataTable,
                  "w-full table-fixed border-collapse text-[11px] sm:text-[12px]",
                )}
              >
                <colgroup>
                  <col className="w-[3%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[11%]" />
                  <col className="w-[17%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={cn(SX.dataTh, "text-center tabular-nums")}>#</th>
                    <th className={SX.dataTh}>Subject</th>
                    <th className={SX.dataTh}>Teacher</th>
                    <th className={SX.dataTh}>When (India)</th>
                    <th className={SX.dataTh}>Student time</th>
                    <th className={SX.dataTh}>Google Meet</th>
                    <th className={SX.dataTh}>Teacher feedback</th>
                    <th className={cn(SX.dataTh, "text-right")}>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const ist = r.isoDate && r.timeHmIST ? istWhenLines(r.isoDate, r.timeHmIST) : null;
                    const stu =
                      r.isoDate && r.timeHmIST
                        ? studentWhenLines(r.isoDate, r.timeHmIST, r.studentTimeZone)
                        : null;
                    const meetUrl = String(r.meetLinkUrl ?? "").trim();
                    const eligible = isTeacherFeedbackEligible(
                      {
                        status: r.status,
                        isoDate: r.isoDate,
                        timeHmIST: r.timeHmIST,
                        teacherFeedbackSubmittedAt:
                          r.teacherFeedbackSubmittedAt ?? null,
                      },
                      new Date(),
                    );
                    const fbSent = !!r.teacherFeedbackInviteSentAt;
                    const fbDone = !!r.teacherFeedbackSubmittedAt;
                    const rowMeetId = String(r.meetRowId ?? "");
                    const rowBusy = saving || statusSavingMeetId === rowMeetId;
                    const canConductNow =
                      !!r.isoDate && !!r.timeHmIST && isDemoTimeReached(r.isoDate, r.timeHmIST);
                    const tone = demoStatusRowClasses(r.status);
                    const inviteSent = !!r.inviteSent;
                    return (
                      <tr
                        key={r.meetRowId || i}
                        className={cn(
                          "align-top transition-colors",
                          tone.text,
                          tone.cellBg,
                          tone.cellBorder,
                        )}
                      >
                        <td className={cn(DEMO_TABLE_TD, "min-w-0 tabular-nums text-center")}>
                          {i + 1}
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0 font-semibold")}>
                          <span className="line-clamp-2 wrap-break-word">{r.subject || "—"}</span>
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0")}>
                          <span className="line-clamp-2 wrap-break-word">{r.teacher || "—"}</span>
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0")}>
                          {ist ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold leading-tight">{ist.date}</div>
                              <div className="text-[10px] font-normal leading-tight opacity-90 sm:text-[11px]">
                                {ist.time}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0")}>
                          {stu ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold leading-tight">{stu.date}</div>
                              <div className="text-[10px] font-normal leading-tight opacity-90 sm:text-[11px]">
                                {stu.time}
                              </div>
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0")}>
                          {meetUrl ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={meetUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "max-w-full cursor-pointer break-all text-left font-semibold text-emerald-600 hover:text-emerald-700 underline decoration-1 underline-offset-2",
                                  rowBusy && "pointer-events-none opacity-50"
                                )}
                                title="Click to open Meet link in new tab"
                              >
                                class link
                              </a>
                              <button
                                type="button"
                                className="shrink-0 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={rowBusy}
                                title="Copy Meet link"
                                onClick={() =>
                                  void navigator.clipboard.writeText(meetUrl).catch(() => {
                                    setMsgDlg({
                                      open: true,
                                      mode: "alert",
                                      variant: "error",
                                      title: "Copy failed",
                                      description:
                                        "Your browser did not allow copying. Try again or copy the link from the address bar after opening it in a new tab.",
                                    });
                                  })
                                }
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  stroke="currentColor"
                                  className="w-4 h-4"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5"
                                  />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <span className="opacity-70">—</span>
                          )}
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0")}>
                          {(() => {
                            const canFbActions =
                              String(r.status ?? "").trim() !== "Cancelled" && !fbDone;
                            const feedbackLabel = fbDone
                              ? "Received Response"
                              : String(r.status ?? "").trim() === "Completed"
                                ? "Awaiting Response"
                                : "Not Yet Received";
                            return (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={cn(
                                    "inline-flex w-max max-w-full rounded-none px-1.5 py-0.5 text-[10px] font-medium ring-1",
                                    fbDone
                                      ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
                                      : String(r.status ?? "").trim() === "Completed"
                                        ? "bg-amber-50 text-amber-900 ring-amber-200"
                                        : "bg-slate-50 text-slate-600 ring-slate-200",
                                  )}
                                >
                                  {feedbackLabel}
                                </span>
                                <div className="flex flex-wrap items-center gap-1">
                                  {(eligible || fbSent) && canFbActions ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        SX.btnSecondary,
                                        "inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-[11px]",
                                      )}
                                      disabled={rowBusy}
                                      onClick={() =>
                                        void sendTeacherFeedback(rowMeetId, fbSent)
                                      }
                                    >
                                      {fbSent ? "Resend feedback" : "Send feedback"}
                                    </button>
                                  ) : null}
                                  {canFbActions ? (
                                    <button
                                      type="button"
                                      className={cn(
                                        SX.btnSecondary,
                                        "inline-flex items-center px-2 py-1 text-[10px] sm:text-[11px]",
                                      )}
                                      title={
                                        eligible
                                          ? "Copy feedback link"
                                          : "Copy link (teacher can open it once the feedback window opens)"
                                      }
                                      disabled={rowBusy}
                                      onClick={() =>
                                        void copyTeacherFeedbackLink(rowMeetId)
                                      }
                                    >
                                      Feedback link
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className={cn(DEMO_TABLE_TD, "min-w-0 text-right")}>
                          <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                            <label className="sr-only" htmlFor={`st-${r.meetRowId}`}>
                              Options for {r.subject}
                            </label>
                            <select
                              id={`st-${r.meetRowId}`}
                              className={cn(
                                SX.select,
                                "min-h-8 w-full min-w-0 max-w-full text-left text-[10px] sm:max-w-44 sm:text-[11px]",
                              )}
                              disabled={statusSavingMeetId === rowMeetId}
                              value={
                                STATUS_OPTIONS.includes(
                                  r.status as (typeof STATUS_OPTIONS)[number],
                                )
                                  ? r.status
                                  : "Scheduled"
                              }
                              onChange={(e) =>
                                requestStatusChangeWithConfirm(
                                  r,
                                  e.target.value,
                                  canConductNow,
                                )
                              }
                            >
                              <option value="Scheduled">Mark as scheduled</option>
                              <option
                                value="Completed"
                                disabled={String(r.status ?? "") !== "Completed" && !canConductNow}
                              >
                                Mark as conducted
                              </option>
                              <option value="Cancelled">Mark as cancelled</option>
                            </select>
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                className={cn(
                                  SX.btnSecondary,
                                  "inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-[11px]",
                                )}
                                disabled={rowBusy}
                                onClick={() => openEdit(r)}
                              >
                                <IconPencil className="opacity-80" />
                                Edit
                              </button>
                              {meetUrl ? (
                                <button
                                  type="button"
                                  className={cn(
                                    inviteSent ? SX.leadBtnGreen : SX.btnPrimary,
                                    "inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-[11px]",
                                  )}
                                  disabled={rowBusy}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    sendDemoInviteEmail(r, inviteSent);
                                  }}
                                >
                                  <>
                                    {inviteSent ? <IconCheck className="h-3.5 w-3.5" /> : null}
                                    Confirm Demo &amp; Send Link
                                  </>
                                </button>
                              ) : (
                                <span className="px-1 py-1 text-[10px] opacity-70 sm:text-[11px]">
                                  No link
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3 text-[11px] leading-relaxed text-slate-600 sm:px-4">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-none border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700">
              IST scheduling
            </span>
            <span className="rounded-none border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Teacher block {tb}m
            </span>
            <span className="rounded-none border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Meet hold {mh}m
            </span>
            <span className="rounded-none border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Auto-complete {ac}m
            </span>
            <span className="rounded-none border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
              Feedback after {fb}m
            </span>
          </div>
          <p className="mt-3">
            Times use <strong className="font-semibold text-slate-800">India Standard Time (IST)</strong>.
            Invites also show the slot in the student&apos;s timezone.
          </p>
          <p className="mt-2">
            Each row reserves one teacher and one Meet link. No overlap within{" "}
            <strong className="font-semibold text-slate-800">{tb} minutes</strong> of the same teacher.
          </p>
          <p className="mt-2">
            Meet holds last <strong className="font-semibold text-slate-800">{mh} minutes</strong>.
            Rows left <strong className="font-semibold text-slate-800">Scheduled</strong> auto-move to{" "}
            <strong className="font-semibold text-slate-800">Completed</strong> after {ac} minutes.{" "}
            <strong className="font-semibold text-slate-800">Cancelled</strong> frees the slot.
          </p>
          <p className="mt-2">
            After <strong className="font-semibold text-slate-800">{fb} minutes</strong> from start, you can email or copy a teacher feedback link; it expires after submission.
          </p>
        </div>
      </div>

      {cancelDemoDialog.open ? (
        <div className="fixed inset-0 z-255 flex items-center justify-center bg-slate-900/50 p-3 backdrop-blur-[2px]">
          <div className="w-[min(100vw-1.5rem,28rem)] overflow-hidden rounded-none border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-[15px] font-bold tracking-tight text-slate-900">
                Cancel demo session?
              </h3>
              <p className="mt-1 text-[12px] text-slate-600">
                Are you sure you want to cancel this session?
              </p>
            </div>
            <div className="space-y-2 px-4 py-4">
              <label className="flex items-center gap-2 text-[13px] text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={cancelDemoDialog.notifyParent}
                  onChange={(e) =>
                    setCancelDemoDialog((prev) => ({
                      ...prev,
                      notifyParent: e.target.checked,
                    }))
                  }
                />
                Notify Parent
              </label>
              <label className="flex items-center gap-2 text-[13px] text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300"
                  checked={cancelDemoDialog.notifyFaculty}
                  onChange={(e) =>
                    setCancelDemoDialog((prev) => ({
                      ...prev,
                      notifyFaculty: e.target.checked,
                    }))
                  }
                />
                Notify Faculty
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
              <button
                type="button"
                className={SX.btnSecondary}
                onClick={closeCancelDemoDialog}
                disabled={cancelDemoDialog.loading}
              >
                Close
              </button>
              <button
                type="button"
                className={cn(SX.btnPrimary, "bg-rose-700 border-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2")}
                onClick={confirmCancelDemo}
                disabled={cancelDemoDialog.loading}
              >
                {cancelDemoDialog.loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018 8 0 018 8 0 01-4.58 4.58l-1.46 1.46a2 2 0 012.84 2.84 012.84 2.84 014.58-4.58L18 16l-4.58-4.58a2 2 0 01-2.84-2.84 012.84-2.84 014.58 2.84L6 8l4.58 4.58a2 2 0 012.84-2.84 012.84 2.84 014.58-2.84L18 16z"
                      />
                    </svg>
                    Processing...
                  </>
                ) : (
                  "Cancel Demo"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {msgDlg.open && msgDlg.mode === "alert" ? (
        <PipelineMessageDialog
          open
          onClose={closeMsgDlg}
          mode="alert"
          variant={msgDlg.variant}
          title={msgDlg.title}
          description={msgDlg.description}
          highlight={msgDlg.highlight}
          meta={msgDlg.meta}
          okLabel={msgDlg.okLabel}
          onConfirm={closeMsgDlg}
        />
      ) : null}
      {msgDlg.open && msgDlg.mode === "confirm" ? (
        <PipelineMessageDialog
          open
          onClose={closeMsgDlg}
          mode="confirm"
          variant={msgDlg.variant}
          title={msgDlg.title}
          description={msgDlg.description}
          highlight={msgDlg.highlight}
          meta={msgDlg.meta}
          confirmLabel={msgDlg.confirmLabel}
          cancelLabel={msgDlg.cancelLabel}
          loading={msgDlg.loading}
          onConfirm={msgDlg.onConfirm}
        />
      ) : null}
    </PipelineStepFrame>
  );
}
