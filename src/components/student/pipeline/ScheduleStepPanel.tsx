import { useMemo, useState, type KeyboardEvent } from "react";
import type { Lead } from "@/lib/types";
import type {
  LeadPipelineMilestoneRow,
  LeadPipelineSchedule,
  LeadPipelineWeeklySessionRow,
} from "@/lib/leadPipelineMetaTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { useScheduleTemplates } from "@/hooks/useScheduleTemplates";
import { buildScheduleFromTemplate, selectDefaultScheduleTemplate } from "@/lib/schedulePlan";
import { appendActivity, mergePipelineMeta } from "@/lib/pipeline";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";
import type { ScheduleStepPanelProps } from "./pipelineStepTypes";
import { PipelineStepFrame } from "./PipelineStepFrame";

const GRID_TABLE =
  "w-full border-collapse border border-[#97a9bc] bg-white text-[14px] text-[#1d2f42]";
const GRID_HEAD =
  "border border-[#6f8aa3] bg-[#164a7f] px-3 py-2 text-center text-[14px] font-semibold text-white";
const GRID_CELL = "border border-[#97a9bc] px-3 py-2 align-middle";
const EXCEL_INPUT =
  "h-9 w-full border-0 bg-transparent px-2 text-[14px] text-[#1d2f42] shadow-none outline-none focus:bg-[#fffbe8] focus:ring-2 focus:ring-[#7aa3cc]/45";
const ACCORDION_HEADER =
  "flex w-full items-center justify-between bg-[#f5f8fb] px-3 py-2.5 text-left transition-colors hover:bg-[#eef4fa]";
const ACCORDION_TITLE = "text-[17px] font-semibold text-[#21384f]";
const ACCORDION_ICON = "text-[14px] font-semibold text-[#3b5c79]";

function subjectAccentClass(idx: number) {
  if (idx === 0) return "text-[#1f6b42] font-semibold";
  if (idx === 1) return "text-[#8a1f2e] font-semibold";
  return "text-[#1f4f7d] font-semibold";
}

function excelMoveNextCell(target: HTMLInputElement) {
  const table = target.closest("[data-excel-grid='true']");
  if (!table) return;
  const cells = Array.from(
    table.querySelectorAll<HTMLInputElement>("input[data-excel-cell='true']"),
  );
  const currentIndex = cells.indexOf(target);
  if (currentIndex < 0) return;
  const next = cells[currentIndex + 1];
  if (next) next.focus();
}

type ScheduleAccordionSection =
  | "programme"
  | "weekly"
  | "milestones"
  | "guidelines";

export function ScheduleStepPanel({
  lead,
  onPatchLead,
  refreshLead,
}: ScheduleStepPanelProps) {
  const { templates, loading, error } = useScheduleTemplates();
  const schedule = (lead.pipelineMeta?.schedule ?? {}) as LeadPipelineSchedule;
  const commencementIsoDate =
    typeof schedule.programmeOverview?.commencementIsoDate === "string"
      ? schedule.programmeOverview.commencementIsoDate
      : "";

  const [dateModalOpen, setDateModalOpen] = useState(!commencementIsoDate);
  const [dateDraft, setDateDraft] = useState(commencementIsoDate || "");
  const [savingDate, setSavingDate] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingWeekly, setEditingWeekly] = useState(false);
  const [editingMilestones, setEditingMilestones] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState<LeadPipelineWeeklySessionRow[]>(
    () => schedule.weeklySessionStructure ?? [],
  );
  const [milestoneDraft, setMilestoneDraft] = useState<LeadPipelineMilestoneRow[]>(
    () => schedule.milestones ?? [],
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<ScheduleAccordionSection, boolean>
  >({
    programme: true,
    weekly: false,
    milestones: false,
    guidelines: false,
  });

  const templateForLead = useMemo(
    () => selectDefaultScheduleTemplate(templates, lead.targetExams),
    [templates, lead.targetExams],
  );

  const syncDraftsFromSchedule = () => {
    setWeeklyDraft(schedule.weeklySessionStructure ?? []);
    setMilestoneDraft(schedule.milestones ?? []);
  };

  const patchSchedule = async (
    schedulePatch: Partial<LeadPipelineSchedule>,
    activityMessage: string,
  ) => {
    await onPatchLead({
      pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
        schedule: schedulePatch,
      }),
      activityLog: appendActivity(lead.activityLog, "schedule", activityMessage),
    });
    await refreshLead();
  };

  const saveCommencementDate = async () => {
    const date = dateDraft.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setSheetError("Select a valid session commencement date.");
      return;
    }
    if (!templateForLead) {
      setSheetError("No active schedule template available. Create one in Schedule Templates.");
      return;
    }
    setSavingDate(true);
    setSheetError(null);
    try {
      const built = buildScheduleFromTemplate({
        template: templateForLead,
        commencementIsoDate: date,
      });
      await patchSchedule(
        {
          templateId: templateForLead.id,
          templateExamValue: templateForLead.examValue,
          templateProgrammeName: templateForLead.programmeName,
          programmeOverview: built.programmeOverview,
          weeklySessionStructure: built.weeklySessionStructure,
          milestones: built.milestones,
          guidelines: built.guidelines,
          classes:
            built.weeklySessionStructure.map((r) => ({
              day: r.day,
              subject: r.subject,
              timeIST: r.timeIST,
              duration: r.sessionDuration,
            })) ?? [],
        },
        `Schedule initialized (${templateForLead.programmeName}) from commencement date ${date}.`,
      );
      setDateModalOpen(false);
      setEditingWeekly(false);
      setEditingMilestones(false);
      setWeeklyDraft(built.weeklySessionStructure);
      setMilestoneDraft(built.milestones);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Could not save schedule date.");
    } finally {
      setSavingDate(false);
    }
  };

  const saveWeekly = async () => {
    setSavingEdit(true);
    setSheetError(null);
    try {
      await patchSchedule(
        {
          weeklySessionStructure: weeklyDraft.map((r, idx) => ({
            ...r,
            sortOrder: idx + 1,
          })),
          classes: weeklyDraft.map((r) => ({
            day: r.day,
            subject: r.subject,
            timeIST: r.timeIST,
            duration: r.sessionDuration,
          })),
        },
        "Weekly Session Structure updated for this student.",
      );
      setEditingWeekly(false);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Could not save weekly structure.");
    } finally {
      setSavingEdit(false);
    }
  };

  const saveMilestones = async () => {
    setSavingEdit(true);
    setSheetError(null);
    try {
      await patchSchedule(
        {
          milestones: milestoneDraft.map((r, idx) => ({ ...r, sortOrder: idx + 1 })),
        },
        "Milestones updated for this student.",
      );
      setEditingMilestones(false);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Could not save milestones.");
    } finally {
      setSavingEdit(false);
    }
  };

  const generatePdf = async () => {
    setPdfBusy(true);
    setSheetError(null);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/schedule-plan/generate`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pdfUrl?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not generate PDF.");
      await refreshLead();
      if (data.pdfUrl) {
        window.open(data.pdfUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Could not generate PDF.");
    } finally {
      setPdfBusy(false);
    }
  };

  const sendSchedule = async () => {
    setSendBusy(true);
    setSheetError(null);
    try {
      await sendLeadPipelineEmail(lead.id, {
        templateKey: "schedule",
        scheduleEmail: {
          attachSchedulePdf: true,
        },
      });
      const now = new Date().toISOString();
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          schedule: {
            scheduleSentEmail: true,
            scheduleSentEmailAt: now,
          },
        }),
        activityLog: appendActivity(lead.activityLog, "schedule", "Schedule emailed to parent with PDF."),
      });
      await refreshLead();
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : "Could not send schedule.");
    } finally {
      setSendBusy(false);
    }
  };

  const programme = schedule.programmeOverview;
  const weekly = schedule.weeklySessionStructure ?? [];
  const milestones = schedule.milestones ?? [];
  const guidelines = schedule.guidelines;
  const schedulePdfUrl = String(schedule.pdfUrl ?? "").trim();
  const weeklyRows = editingWeekly ? weeklyDraft : weekly;
  const milestoneRows = editingMilestones ? milestoneDraft : milestones;
  const commencementBanner =
    programme?.startDateLabel || "Set session commencement date";
  const durationBanner = programme?.durationLabel || "—";
  const targetBanner = programme?.targetExamLabel || "—";

  const onGridKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    excelMoveNextCell(e.currentTarget);
  };

  const toggleSection = (section: Exclude<ScheduleAccordionSection, "programme">) => {
    setExpandedSections((prev) => ({
      ...prev,
      programme: true,
      [section]: !prev[section],
    }));
  };

  return (
    <PipelineStepFrame stepNumber={4} leadId={lead.id}>
      <div className="flex min-h-0 flex-1 flex-col bg-[#f6f8fb]">
        <div className="border-b border-[#d5dde6] bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900">
                Step 4 - Schedule Planner
              </h2>
              <p className="mt-1 text-[12px] text-slate-600">
                Clean, editable schedule view for this student.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SX.btnSecondary}
                onClick={() => setDateModalOpen(true)}
              >
                Set commencement date
              </button>
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={pdfBusy}
                onClick={generatePdf}
              >
                {pdfBusy ? "Generating..." : "Generate PDF"}
              </button>
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={!schedulePdfUrl}
                onClick={() => window.open(schedulePdfUrl, "_blank", "noopener,noreferrer")}
              >
                Preview PDF
              </button>
              <button
                type="button"
                className={SX.btnPrimary}
                disabled={sendBusy || !schedulePdfUrl}
                onClick={() => void sendSchedule()}
              >
                {sendBusy ? "Sending..." : "Send to student"}
              </button>
            </div>
          </div>
          {sheetError ? (
            <p className="mt-2 text-[12px] text-rose-700" role="alert">
              {sheetError}
            </p>
          ) : null}
          {error ? (
            <p className="mt-2 text-[12px] text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb]">
          <div className="w-full border border-[#b7c7d7] bg-white shadow-sm">
            <div className="border-b border-[#6f8aa3] bg-[#184b7f] px-4 py-3">
              <h3 className="text-center text-[24px] font-bold uppercase tracking-[0.08em] text-white sm:text-[28px]">
                Weekly Session Plan
              </h3>
            </div>
            <div className="border-b border-[#8ba2b8] bg-[#2d628e] px-3 py-1.5 text-center text-[13px] font-medium text-[#e7f0f8]">
              Session Commencement: {commencementBanner} | Duration: {durationBanner}
              {" "}
              (up to {targetBanner})
            </div>

            <div className="space-y-3 p-3 sm:p-4">
              <section className="overflow-hidden border border-[#cfd9e3]">
                <div className="flex w-full items-center justify-between bg-[#f5f8fb] px-3 py-2.5">
                  <span className={ACCORDION_TITLE}>1. Programme Overview</span>
                </div>
                <div className="p-3">
                  <div className="overflow-x-auto">
                    <table className={cn(GRID_TABLE, "min-w-[720px]")}>
                      <thead>
                        <tr>
                          <th className={GRID_HEAD}>Programme</th>
                          <th className={GRID_HEAD}>Start Date</th>
                          <th className={GRID_HEAD}>Duration</th>
                          <th className={GRID_HEAD}>Target Exam</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-[#edf1f5]">
                          <td className={cn(GRID_CELL, "font-semibold")}>
                            {programme?.programmeName ||
                              schedule.templateProgrammeName ||
                              "—"}
                          </td>
                          <td className={GRID_CELL}>
                            {programme?.startDateLabel || "—"}
                          </td>
                          <td className={GRID_CELL}>
                            {programme?.durationLabel || "—"}
                          </td>
                          <td className={GRID_CELL}>
                            {programme?.targetExamLabel || "—"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden border border-[#cfd9e3]">
                <button
                  type="button"
                  className={ACCORDION_HEADER}
                  onClick={() => toggleSection("weekly")}
                >
                  <span className={ACCORDION_TITLE}>
                    2. Weekly Session Structure
                  </span>
                  <span className={ACCORDION_ICON}>
                    {expandedSections.weekly ? "Collapse" : "Expand"}
                  </span>
                </button>
                {expandedSections.weekly ? (
                  <div className="space-y-3 p-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {editingWeekly ? (
                        <>
                          <button
                            type="button"
                            className={SX.btnSecondary}
                            disabled={savingEdit}
                            onClick={() => {
                              syncDraftsFromSchedule();
                              setEditingWeekly(false);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={SX.btnPrimary}
                            disabled={savingEdit}
                            onClick={() => void saveWeekly()}
                          >
                            {savingEdit ? "Saving..." : "Save weekly sheet"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={SX.btnSecondary}
                          onClick={() => {
                            setWeeklyDraft(weekly);
                            setEditingWeekly(true);
                          }}
                        >
                          Edit weekly sheet
                        </button>
                      )}
                    </div>
                    <p className="text-[14px] text-[#374e63]">
                      3 sessions per week are conducted across the following subjects:
                    </p>
                    {editingWeekly ? (
                      <p className="text-[12px] text-[#466584]">
                        Edit mode active: press Enter to jump to next cell.
                      </p>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table
                        className={cn(GRID_TABLE, "min-w-[920px]")}
                        data-excel-grid="true"
                      >
                        <thead>
                          <tr>
                            <th className={GRID_HEAD}>Session</th>
                            <th className={GRID_HEAD}>Day</th>
                            <th className={GRID_HEAD}>Time (IST)</th>
                            <th className={GRID_HEAD}>Subject</th>
                            <th className={GRID_HEAD}>Session Duration</th>
                            {editingWeekly ? (
                              <th className={cn(GRID_HEAD, "w-[110px]")}>
                                Action
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyRows.map((r, idx) => (
                            <tr
                              key={r.id}
                              className={
                                idx % 2 === 0 ? "bg-[#eef3f7]" : "bg-[#f7f9fb]"
                              }
                            >
                              <td
                                className={cn(
                                  GRID_CELL,
                                  "font-semibold",
                                  subjectAccentClass(idx),
                                )}
                              >
                                {editingWeekly ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.sessionLabel}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setWeeklyDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? {
                                                ...x,
                                                sessionLabel: e.target.value,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.sessionLabel
                                )}
                              </td>
                              <td className={GRID_CELL}>
                                {editingWeekly ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.day}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setWeeklyDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? { ...x, day: e.target.value }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.day
                                )}
                              </td>
                              <td className={GRID_CELL}>
                                {editingWeekly ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.timeIST}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setWeeklyDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? { ...x, timeIST: e.target.value }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.timeIST
                                )}
                              </td>
                              <td className={cn(GRID_CELL, subjectAccentClass(idx))}>
                                {editingWeekly ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.subject}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setWeeklyDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? { ...x, subject: e.target.value }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.subject
                                )}
                              </td>
                              <td className={GRID_CELL}>
                                {editingWeekly ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.sessionDuration}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setWeeklyDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? {
                                                ...x,
                                                sessionDuration: e.target.value,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.sessionDuration
                                )}
                              </td>
                              {editingWeekly ? (
                                <td className={cn(GRID_CELL, "text-center")}>
                                  <button
                                    type="button"
                                    className={SX.btnGhost}
                                    onClick={() =>
                                      setWeeklyDraft((prev) =>
                                        prev.filter((x) => x.id !== r.id),
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {editingWeekly ? (
                      <div>
                        <button
                          type="button"
                          className={SX.btnSecondary}
                          onClick={() =>
                            setWeeklyDraft((prev) => [
                              ...prev,
                              {
                                id: crypto.randomUUID(),
                                sessionLabel: `Session ${prev.length + 1}`,
                                day: "",
                                timeIST: "",
                                subject: "",
                                sessionDuration: "90 Minutes",
                                sortOrder: prev.length + 1,
                              },
                            ])
                          }
                        >
                          Add session row
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden border border-[#cfd9e3]">
                <button
                  type="button"
                  className={ACCORDION_HEADER}
                  onClick={() => toggleSection("milestones")}
                >
                  <span className={ACCORDION_TITLE}>
                    3. Key Milestones & Examination Timelines
                  </span>
                  <span className={ACCORDION_ICON}>
                    {expandedSections.milestones ? "Collapse" : "Expand"}
                  </span>
                </button>
                {expandedSections.milestones ? (
                  <div className="space-y-3 p-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {editingMilestones ? (
                        <>
                          <button
                            type="button"
                            className={SX.btnSecondary}
                            disabled={savingEdit}
                            onClick={() => {
                              syncDraftsFromSchedule();
                              setEditingMilestones(false);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className={SX.btnPrimary}
                            disabled={savingEdit}
                            onClick={() => void saveMilestones()}
                          >
                            {savingEdit ? "Saving..." : "Save milestone sheet"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={SX.btnSecondary}
                          onClick={() => {
                            setMilestoneDraft(milestones);
                            setEditingMilestones(true);
                          }}
                        >
                          Edit milestone sheet
                        </button>
                      )}
                    </div>
                    <p className="text-[14px] text-[#374e63]">
                      The following milestones must be tracked throughout the
                      programme:
                    </p>
                    {editingMilestones ? (
                      <p className="text-[12px] text-[#466584]">
                        Edit mode active: press Enter to jump to next cell.
                      </p>
                    ) : null}
                    <div className="overflow-x-auto">
                      <table
                        className={cn(GRID_TABLE, "min-w-[960px]")}
                        data-excel-grid="true"
                      >
                        <thead>
                          <tr>
                            <th className={cn(GRID_HEAD, "w-[56px]")}>#</th>
                            <th className={GRID_HEAD}>Target Date</th>
                            <th className={GRID_HEAD}>Milestone</th>
                            <th className={GRID_HEAD}>Description</th>
                            {editingMilestones ? (
                              <th className={cn(GRID_HEAD, "w-[110px]")}>
                                Action
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {milestoneRows.map((r, idx) => (
                            <tr
                              key={r.id}
                              className={
                                idx % 2 === 0 ? "bg-[#eef3f7]" : "bg-[#f7f9fb]"
                              }
                            >
                              <td
                                className={cn(
                                  GRID_CELL,
                                  "text-center font-semibold tabular-nums",
                                )}
                              >
                                {idx + 1}
                              </td>
                              <td className={cn(GRID_CELL, "font-semibold text-[#2b5f87]")}>
                                {editingMilestones ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.targetDateLabel}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setMilestoneDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? {
                                                ...x,
                                                targetDateLabel:
                                                  e.target.value,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.targetDateLabel
                                )}
                              </td>
                              <td className={cn(GRID_CELL, "font-semibold")}>
                                {editingMilestones ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.milestone}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setMilestoneDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? { ...x, milestone: e.target.value }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.milestone
                                )}
                              </td>
                              <td className={GRID_CELL}>
                                {editingMilestones ? (
                                  <input
                                    data-excel-cell="true"
                                    className={EXCEL_INPUT}
                                    value={r.description}
                                    onKeyDown={onGridKeyDown}
                                    onChange={(e) =>
                                      setMilestoneDraft((prev) =>
                                        prev.map((x) =>
                                          x.id === r.id
                                            ? {
                                                ...x,
                                                description: e.target.value,
                                              }
                                            : x,
                                        ),
                                      )
                                    }
                                  />
                                ) : (
                                  r.description
                                )}
                              </td>
                              {editingMilestones ? (
                                <td className={cn(GRID_CELL, "text-center")}>
                                  <button
                                    type="button"
                                    className={SX.btnGhost}
                                    onClick={() =>
                                      setMilestoneDraft((prev) =>
                                        prev.filter((x) => x.id !== r.id),
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {editingMilestones ? (
                      <div>
                        <button
                          type="button"
                          className={SX.btnSecondary}
                          onClick={() =>
                            setMilestoneDraft((prev) => [
                              ...prev,
                              {
                                id: crypto.randomUUID(),
                                targetDateLabel: "",
                                milestone: "",
                                description: "",
                                sortOrder: prev.length + 1,
                              },
                            ])
                          }
                        >
                          Add milestone row
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="overflow-hidden border border-[#cfd9e3]">
                <button
                  type="button"
                  className={ACCORDION_HEADER}
                  onClick={() => toggleSection("guidelines")}
                >
                  <span className={ACCORDION_TITLE}>
                    4. Study & Preparation Guidelines
                  </span>
                  <span className={ACCORDION_ICON}>
                    {expandedSections.guidelines ? "Collapse" : "Expand"}
                  </span>
                </button>
                {expandedSections.guidelines ? (
                  <div className="p-3">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h5 className="mb-2 text-[20px] font-semibold text-[#2e648d] sm:text-[22px]">
                          General Guidelines
                        </h5>
                        <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-[#24384b] sm:text-[15px]">
                          {(guidelines?.generalGuidelines ?? []).map(
                            (line, idx) => (
                              <li key={`${line}-${idx}`}>{line}</li>
                            ),
                          )}
                        </ul>
                      </div>
                      <div>
                        <h5 className="mb-2 text-[20px] font-semibold text-[#2e648d] sm:text-[22px]">
                          Mock Tests & Revision Schedule
                        </h5>
                        <ul className="list-disc space-y-1.5 pl-5 text-[14px] leading-6 text-[#24384b] sm:text-[15px]">
                          {(guidelines?.mockTestsRevision ?? []).map(
                            (line, idx) => (
                              <li key={`${line}-${idx}`}>{line}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>
          </div>

        </div>
      </div>

      {dateModalOpen ? (
        <div className="fixed inset-0 z-240 flex items-center justify-center bg-slate-900/45 p-3">
          <div className="w-[min(100vw-1.5rem,30rem)] border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-[15px] font-bold text-slate-900">
                Session Commencement
              </h3>
              <p className="mt-1 text-[12px] text-slate-600">
                Select start date once. Plan sections auto-fill from schedule template.
              </p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Commencement date
                </span>
                <input
                  type="date"
                  className={cn(SX.input, "mt-1 w-full")}
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                />
              </label>
              <p className="text-[12px] text-slate-600">
                Template:{" "}
                <strong>
                  {templateForLead
                    ? `${templateForLead.programmeName} (${templateForLead.examValue})`
                    : loading
                      ? "Loading..."
                      : "No active template"}
                </strong>
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <button
                type="button"
                className={SX.btnSecondary}
                onClick={() => setDateModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className={SX.btnPrimary}
                disabled={savingDate}
                onClick={() => void saveCommencementDate()}
              >
                {savingDate ? "Saving..." : "Save date"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PipelineStepFrame>
  );
}
