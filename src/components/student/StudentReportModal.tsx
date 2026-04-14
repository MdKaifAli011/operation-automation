"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import type { Lead } from "@/lib/types";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

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
  const sr = lead.pipelineMeta?.studentReport as
    | {
        additionalNotes?: string;
        recommendations?: string;
        pdfUrl?: string | null;
        fileName?: string | null;
        generatedAt?: string | null;
        generatedForMeetRowId?: string | null;
        sendConfirmedAt?: string | null;
      }
    | undefined;

  const demoRows: DemoTableRowPersisted[] =
    (lead.pipelineMeta?.demo as { rows?: DemoTableRowPersisted[] } | undefined)
      ?.rows ?? [];

  const [genError, setGenError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGenError(null);
    setLocalPreviewUrl(sr?.pdfUrl?.trim() ? sr.pdfUrl : null);
  }, [open, lead.id, sr?.pdfUrl]);

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
  const generatedForSelected =
    !!previewSrc &&
    !!selectedItem &&
    String(sr?.generatedForMeetRowId ?? "").trim() === selectedItem.key;

  const generateSelectedPdf = async () => {
    if (!selectedItem) {
      setGenError("Select a demo report first.");
      return;
    }
    const meetRowId = selectedItem.row.meetRowId?.trim();
    if (!meetRowId) {
      setGenError(
        "This demo row is missing an id. Edit and save it once in Step 1, then retry.",
      );
      return;
    }
    setGeneratingKey(selectedItem.key);
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
      onToast?.(`${selectedItem.label} generated successfully.`);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGeneratingKey(null);
    }
  };

  const confirmForSending = async () => {
    setConfirmBusy(true);
    setGenError(null);
    try {
      const now = new Date().toISOString();
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          studentReport: {
            sendConfirmedAt: now,
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          "Student progress report confirmed — ready to share with family.",
        ),
      });
      await refreshLead();
      onToast?.("Report confirmed for sending.");
      onClose();
    } catch {
      setGenError("Could not save confirmation.");
    } finally {
      setConfirmBusy(false);
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
          Select a demo report, review details, then generate that single PDF.
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
          {reportItems.length === 0 ? (
            <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
              No demo rows found. Add demos in Step 1 first.
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

        {selectedItem ? (
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

        {genError ? (
          <p className="mb-3 text-[12px] text-red-700" role="alert">
            {genError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={!selectedItem || generatingKey !== null}
            onClick={() => void generateSelectedPdf()}
          >
            {selectedItem && generatingKey === selectedItem.key
              ? "Generating..."
              : "Generate this report"}
          </button>
          {generatedForSelected && previewSrc ? (
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
            disabled={confirmBusy}
            onClick={() => void confirmForSending()}
          >
            {confirmBusy ? "Saving..." : "Confirm for sending"}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
