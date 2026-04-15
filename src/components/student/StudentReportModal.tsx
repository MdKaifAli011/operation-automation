"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import type { Lead } from "@/lib/types";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";

function ratingLabel(v: string | undefined): string {
  if (!v?.trim()) return "—";
  const m: Record<string, string> = {
    excellent: "Excellent",
    good: "Good",
    satisfactory: "Satisfactory",
    needs_improvement: "Needs improvement",
  };
  return m[v] ?? v;
}

function rowKey(r: DemoTableRowPersisted, i: number): string {
  const id = r.meetRowId?.trim();
  if (id) return id;
  return `${r.isoDate || "d"}-${r.timeHmIST || "t"}-${i}`;
}

function hasTeacherFeedback(r: DemoTableRowPersisted): boolean {
  return Boolean(
    r.teacherFeedbackSubmittedAt?.trim() ||
    r.teacherFeedbackRating?.trim() ||
    r.teacherFeedbackStrengths?.trim() ||
    r.teacherFeedbackImprovements?.trim() ||
    r.teacherFeedbackNotes?.trim(),
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
  onToast?: (message: string) => void;
};

const ATTEMPTED_OPTIONS = [
  "10",
  "15",
  "20",
  "25",
  "30",
  "40",
  "50",
] as const;
const STUDENT_LEVEL_OPTIONS = [
  "Beginner",
  "Average",
  "Good",
  "Very Good",
  "Excellent",
] as const;

export function StudentReportModal({
  open,
  onClose,
  lead,
  onPatchLead,
  refreshLead,
  onToast,
}: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const sr = lead.pipelineMeta?.studentReport as
    | {
        additionalNotes?: string;
        recommendations?: string;
        pdfUrl?: string | null;
        fileName?: string | null;
        generatedAt?: string | null;
        generatedForMeetRowId?: string | null;
        sendConfirmedAt?: string | null;
      source?: "teacher_feedback" | "manual_sales" | "uploaded_custom";
      manualQuestionsAttempted?: string;
      manualCorrectAnswers?: string;
      manualStudentLevel?: string;
      }
    | undefined;

  const demoRows: DemoTableRowPersisted[] =
    (lead.pipelineMeta?.demo as { rows?: DemoTableRowPersisted[] } | undefined)
      ?.rows ?? [];

  const [genError, setGenError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [sendingBusy, setSendingBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [manualAttempted, setManualAttempted] = useState<string>(
    ATTEMPTED_OPTIONS[2] ?? "20",
  );
  const [manualCorrect, setManualCorrect] = useState<string>("10");
  const [manualLevel, setManualLevel] = useState<string>(
    STUDENT_LEVEL_OPTIONS[1] ?? "Average",
  );

  useEffect(() => {
    if (!open) return;
    setGenError(null);
    setLocalPreviewUrl(sr?.pdfUrl?.trim() ? sr.pdfUrl : null);
    setManualAttempted(
      sr?.manualQuestionsAttempted?.trim() ||
        ATTEMPTED_OPTIONS[2] ||
        "20",
    );
    setManualCorrect(sr?.manualCorrectAnswers?.trim() || "10");
    setManualLevel(
      sr?.manualStudentLevel?.trim() || STUDENT_LEVEL_OPTIONS[1] || "Average",
    );
  }, [
    open,
    lead.id,
    sr?.pdfUrl,
    sr?.manualQuestionsAttempted,
    sr?.manualCorrectAnswers,
    sr?.manualStudentLevel,
  ]);

  useEffect(() => {
    if (!open) return;
    const firstIndex = demoRows.findIndex((r) => hasTeacherFeedback(r));
    const firstKey =
      firstIndex >= 0 ? rowKey(demoRows[firstIndex]!, firstIndex) : "";
    if (!firstKey) {
      setSelectedReportKey("");
      return;
    }
    setSelectedReportKey((prev) => prev || firstKey);
  }, [open, demoRows]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, onClose]);

  const previewSrc =
    localPreviewUrl?.trim() || (sr?.pdfUrl?.trim() ? sr.pdfUrl : null);

  const reportItems = useMemo(
    () =>
      demoRows
        .filter((r) => hasTeacherFeedback(r))
        .map((r, i) => ({
          key: rowKey(r, i),
          label: `Demo report ${i + 1}`,
          row: r,
        })),
    [demoRows],
  );

  const selectedItem =
    reportItems.find((x) => x.key === selectedReportKey) ?? null;
  const fallbackMode = reportItems.length === 0;

  const maxCorrect = Math.max(0, Number.parseInt(manualAttempted || "0", 10) || 0);
  const correctOptions = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= maxCorrect; i += 1) out.push(String(i));
    return out.length ? out : ["0"];
  }, [maxCorrect]);

  useEffect(() => {
    if (!correctOptions.includes(manualCorrect)) {
      setManualCorrect(correctOptions[correctOptions.length - 1] ?? "0");
    }
  }, [correctOptions, manualCorrect]);

  const generateSelectedPdf = async () => {
    if (!selectedItem && !fallbackMode) {
      setGenError("Select a demo report first.");
      return;
    }
    const meetRowId = selectedItem?.row.meetRowId?.trim();
    if (!fallbackMode && !meetRowId) {
      setGenError("Selected demo row is missing id. Save row in Step 1 and retry.");
      return;
    }
    if (fallbackMode && (!manualAttempted || !manualLevel)) {
      setGenError("Please complete all fallback inputs first.");
      return;
    }
    setGeneratingKey(selectedItem?.key ?? "manual");
    setGenError(null);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/student-report/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            additionalNotes: "",
            recommendations: "",
            meetRowId,
            manualQuestionsAttempted: fallbackMode ? manualAttempted : "",
            manualCorrectAnswers: fallbackMode ? manualCorrect : "",
            manualStudentLevel: fallbackMode ? manualLevel : "",
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pdfUrl?: string;
      };
      if (!res.ok) throw new Error(data.error || "Could not generate PDF");
      if (data.pdfUrl) setLocalPreviewUrl(data.pdfUrl);
      await refreshLead();
      onToast?.(
        fallbackMode
          ? "Manual report generated successfully."
          : `${selectedItem?.label ?? "Report"} generated successfully.`,
      );
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGeneratingKey(null);
    }
  };

  const uploadCustomReport = async (file: File) => {
    setUploading(true);
    setGenError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/documents-upload`,
        {
          method: "POST",
          body: fd,
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        storedFileUrl?: string;
        fileName?: string;
      };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const pdfUrl = String(data.storedFileUrl ?? "").trim();
      if (!pdfUrl) throw new Error("Upload failed");
      const fileName = String(data.fileName ?? "").trim() || file.name;
      const now = new Date().toISOString();
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          studentReport: {
            pdfUrl,
            fileName,
            generatedAt: now,
            source: "uploaded_custom",
            generatedForMeetRowId: null,
            manualQuestionsAttempted: "",
            manualCorrectAnswers: "",
            manualStudentLevel: "",
            sendConfirmedAt: null,
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          "Custom student report uploaded from report modal.",
        ),
      });
      setLocalPreviewUrl(pdfUrl);
      await refreshLead();
      onToast?.("Custom report uploaded successfully.");
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const sendReport = async () => {
    if (!previewSrc) {
      setGenError("Generate or upload the report before sending.");
      return;
    }
    setSendingBusy(true);
    setGenError(null);
    try {
      const now = new Date().toISOString();
      await sendLeadPipelineEmail(lead.id, {
        templateKey: "brochure",
        brochureEmail: {
          selectionKeys: [],
          includeStudentReportPdf: true,
        },
      });
      const docsItems = Array.isArray(
        (lead.pipelineMeta as { documents?: { items?: Array<Record<string, unknown>> } } | undefined)
          ?.documents?.items,
      )
        ? [
            ...(
              (lead.pipelineMeta as {
                documents?: { items?: Array<Record<string, unknown>> };
              } | undefined)?.documents?.items ?? []
            ),
          ]
        : [];
      const reportIdx = docsItems.findIndex(
        (x) => String(x?.key ?? "").trim() === "report",
      );
      if (reportIdx >= 0) {
        docsItems[reportIdx] = {
          ...docsItems[reportIdx],
          sentAt: now,
        };
      } else {
        docsItems.push({
          key: "report",
          title: "Demo Session Report - Feedback",
          countLabel: "1",
          sentAt: now,
        });
      }
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          studentReport: {
            sendConfirmedAt: now,
          },
          documents: {
            items: docsItems,
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          "Student progress report sent from report modal.",
        ),
      });
      await refreshLead();
      onToast?.("Report sent successfully.");
      onClose();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setSendingBusy(false);
    }
  };

  const name = lead.studentName?.trim() || "Student";

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed left-1/2 top-1/2 z-220 w-[min(100vw-1rem,760px)] max-h-[min(92vh,920px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl",
        "backdrop:bg-black/45 open:flex open:flex-col",
      )}
      onClose={onClose}
      aria-labelledby={`${id}-title`}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3">
        <h2
          id={`${id}-title`}
          className="text-[15px] font-bold tracking-tight text-slate-900"
        >
          Demo Session Report - Feedback
        </h2>
        <p className="mt-1 text-[12px] text-slate-600">
          Generate from faculty feedback or use fallback/manual inputs.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="mb-3">
          <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            Student
          </h3>
          <p className="text-[14px] font-medium text-slate-900">{name}</p>
        </section>

        <section className="mb-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            Reports list
          </h3>
          {fallbackMode ? (
            <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
              Faculty feedback is unavailable. Use manual fallback inputs below.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {reportItems.map((item) => {
                const selected = item.key === selectedReportKey;
                const hasFb = hasTeacherFeedback(item.row);
                const isGenerated =
                  !!previewSrc &&
                  String(sr?.generatedForMeetRowId ?? "").trim() === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "text-left rounded-none border px-3 py-2 transition-colors",
                      selected
                        ? "border-primary bg-sky-50 ring-1 ring-primary/20"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                    )}
                    onClick={() => setSelectedReportKey(item.key)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span
                        className={cn(
                          "rounded-none px-1.5 py-0.5 text-[10px] ring-1",
                          isGenerated
                            ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                            : hasFb
                              ? "bg-sky-50 text-sky-900 ring-sky-200"
                              : "bg-slate-50 text-slate-600 ring-slate-200",
                        )}
                      >
                        {isGenerated
                          ? "Generated"
                          : hasFb
                            ? "Feedback ready"
                            : "No feedback yet"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {item.row.isoDate || "—"} · {item.row.timeHmIST || "—"}{" "}
                      IST · {item.row.subject || "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedItem && !fallbackMode ? (
          <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Basic details
            </h3>
            <p className="mt-1 text-[13px] font-semibold text-slate-900">
              {selectedItem.label}
            </p>
            <p className="mt-1 text-[12px] text-slate-700">
              {selectedItem.row.isoDate || "—"} ·{" "}
              {selectedItem.row.timeHmIST || "—"} IST ·{" "}
              {selectedItem.row.subject || "—"} ·{" "}
              {selectedItem.row.teacher || "—"}
            </p>
            <p className="mt-1 text-[12px] text-slate-700">
              Overall: {ratingLabel(selectedItem.row.teacherFeedbackRating)}
            </p>
            {selectedItem.row.teacherFeedbackStrengths?.trim() ? (
              <p className="mt-1 text-[12px] text-slate-700">
                <span className="font-medium">Strengths:</span>{" "}
                {selectedItem.row.teacherFeedbackStrengths.trim()}
              </p>
            ) : null}
            {selectedItem.row.teacherFeedbackImprovements?.trim() ? (
              <p className="mt-1 text-[12px] text-slate-700">
                <span className="font-medium">Areas to improve:</span>{" "}
                {selectedItem.row.teacherFeedbackImprovements.trim()}
              </p>
            ) : null}
            {selectedItem.row.teacherFeedbackNotes?.trim() ? (
              <p className="mt-1 text-[12px] text-slate-700">
                {selectedItem.row.teacherFeedbackNotes.trim()}
              </p>
            ) : null}
          </section>
        ) : null}

        {fallbackMode ? (
          <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2.5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Manual fallback inputs
            </h3>
            <p className="mt-1 text-[12px] text-slate-700">
              Use these inputs when faculty response is not received and sales team
              needs to send the report.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-[12px] font-medium text-slate-700">
                No. of Questions Attempted
                <select
                  className={cn(SX.select, "mt-1 w-full")}
                  value={manualAttempted}
                  onChange={(e) => setManualAttempted(e.target.value)}
                >
                  {ATTEMPTED_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-slate-700">
                Correct Answers
                <select
                  className={cn(SX.select, "mt-1 w-full")}
                  value={manualCorrect}
                  onChange={(e) => setManualCorrect(e.target.value)}
                >
                  {correctOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px] font-medium text-slate-700">
                Student Level
                <select
                  className={cn(SX.select, "mt-1 w-full")}
                  value={manualLevel}
                  onChange={(e) => setManualLevel(e.target.value)}
                >
                  {STUDENT_LEVEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {genError ? (
          <p className="mb-3 text-[12px] text-red-700" role="alert">
            {genError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={(!selectedItem && !fallbackMode) || generatingKey !== null}
            onClick={() => void generateSelectedPdf()}
          >
            {generatingKey ? "Generating..." : "Generate Report"}
          </button>
          <button
            type="button"
            className={SX.btnSecondary}
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            {uploading ? "Uploading..." : "Upload Report"}
          </button>
          {previewSrc ? (
            <button
              type="button"
              className={SX.btnSecondary}
              onClick={() =>
                window.open(previewSrc, "_blank", "noopener,noreferrer")
              }
            >
              View report
            </button>
          ) : null}
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.currentTarget.value = "";
              if (!file) return;
              void uploadCustomReport(file);
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Close
        </button>
        {previewSrc ? (
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={sendingBusy}
            onClick={() => void sendReport()}
          >
            {sendingBusy ? "Sending..." : "Send Report"}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
