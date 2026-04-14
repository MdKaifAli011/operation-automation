"use client";

import { useEffect, useId, useRef, useState } from "react";
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

function hasTeacherFeedback(r: DemoTableRowPersisted): boolean {
  return Boolean(
    r.teacherFeedbackSubmittedAt?.trim() ||
      r.teacherFeedbackRating?.trim() ||
      r.teacherFeedbackStrengths?.trim() ||
      r.teacherFeedbackImprovements?.trim() ||
      r.teacherFeedbackNotes?.trim(),
  );
}

function feedbackStatusLabel(r: DemoTableRowPersisted): string {
  if (hasTeacherFeedback(r)) return "Submitted";
  return "—";
}

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
};

export function StudentReportModal({
  open,
  onClose,
  lead,
  onPatchLead,
  refreshLead,
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
        sendConfirmedAt?: string | null;
      }
    | undefined;

  const demoRows: DemoTableRowPersisted[] =
    (lead.pipelineMeta?.demo as { rows?: DemoTableRowPersisted[] } | undefined)
      ?.rows ?? [];

  const feedbackRows = demoRows;

  const [additionalNotes, setAdditionalNotes] = useState(
    () => sr?.additionalNotes ?? "",
  );
  const [recommendations, setRecommendations] = useState(
    () => sr?.recommendations ?? "",
  );
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [selectedFeedbackKey, setSelectedFeedbackKey] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setAdditionalNotes(sr?.additionalNotes ?? "");
    setRecommendations(sr?.recommendations ?? "");
    setGenError(null);
    setLocalPreviewUrl(sr?.pdfUrl?.trim() ? sr.pdfUrl : null);
  }, [open, lead.id, sr?.additionalNotes, sr?.recommendations, sr?.pdfUrl]);

  useEffect(() => {
    if (!open) return;
    const first = feedbackRows[0];
    if (!first) {
      setSelectedFeedbackKey("");
      return;
    }
    setSelectedFeedbackKey(first.meetRowId?.trim() || `${first.isoDate}-${first.timeHmIST}`);
  }, [open, feedbackRows]);

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
    localPreviewUrl?.trim() ||
    (sr?.pdfUrl?.trim() ? sr.pdfUrl : null);
  const selectedFeedbackRow =
    feedbackRows.find(
      (r) =>
        (r.meetRowId?.trim() || `${r.isoDate}-${r.timeHmIST}`) ===
        selectedFeedbackKey,
    ) ?? null;

  const generatePdf = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(
        `/api/leads/${encodeURIComponent(lead.id)}/student-report/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ additionalNotes, recommendations }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        pdfUrl?: string;
        lead?: Lead;
      };
      if (!res.ok) {
        throw new Error(data.error || "Could not generate PDF");
      }
      if (data.pdfUrl) {
        setLocalPreviewUrl(data.pdfUrl);
      }
      await refreshLead();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
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
        "fixed left-1/2 top-1/2 z-220 w-[min(100vw-1rem,640px)] max-h-[min(92vh,900px)] -translate-x-1/2 -translate-y-1/2",
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
          Generate student report
        </h2>
        <p className="mt-1 text-[12px] text-slate-600">
          Review demo feedback, add your notes, then generate a PDF. Confirm when
          it is ready to email or message to the family.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="mb-4">
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            Student
          </h3>
          <p className="text-[14px] font-medium text-slate-900">{name}</p>
        </section>

        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">
              Demo Session Report - Feedback
            </h3>
            <p className="text-[11px] text-slate-500">From Step 1 — full detail on View</p>
          </div>
          {feedbackRows.length === 0 ? (
            <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
              No demos found yet. Schedule demo rows in Step 1 first.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto border border-slate-200">
                <table className={cn(SX.dataTable, "w-full min-w-[760px] table-fixed text-[12px]")}>
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[17%]" />
                    <col className="w-[22%]" />
                    <col className="w-[13%]" />
                    <col className="w-[12%]" />
                    <col className="w-[6%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={SX.dataTh}>Date</th>
                      <th className={SX.dataTh}>Time (IST)</th>
                      <th className={SX.dataTh}>Subject</th>
                      <th className={SX.dataTh}>Teacher</th>
                      <th className={SX.dataTh}>Overall</th>
                      <th className={SX.dataTh}>Feedback</th>
                      <th className={cn(SX.dataTh, "text-center")}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackRows.map((r, i) => {
                      const key = r.meetRowId?.trim() || `${r.isoDate}-${r.timeHmIST}-${i}`;
                      const selected = key === selectedFeedbackKey;
                      return (
                        <tr key={key} className={selected ? "bg-sky-50/70" : undefined}>
                          <td className={SX.dataTd}>{r.isoDate || "—"}</td>
                          <td className={SX.dataTd}>{r.timeHmIST || "—"}</td>
                          <td className={SX.dataTd}>{r.subject || "—"}</td>
                          <td className={SX.dataTd}>{r.teacher || "—"}</td>
                          <td className={SX.dataTd}>{ratingLabel(r.teacherFeedbackRating)}</td>
                          <td className={SX.dataTd}>{feedbackStatusLabel(r)}</td>
                          <td className={cn(SX.dataTd, "text-center")}>
                            <button
                              type="button"
                              className={cn(SX.btnSecondary, "h-7 px-2 text-[11px]")}
                              onClick={() => setSelectedFeedbackKey(key)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedFeedbackRow ? (
                <div className="mt-3 border border-slate-200 bg-slate-50/50 px-3 py-2">
                  <p className="text-[12px] font-semibold text-slate-900">
                    {selectedFeedbackRow.subject || "—"} · {selectedFeedbackRow.teacher || "—"} ·{" "}
                    {selectedFeedbackRow.isoDate || "—"} {selectedFeedbackRow.timeHmIST || ""}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-700">
                    Overall: {ratingLabel(selectedFeedbackRow.teacherFeedbackRating)}
                  </p>
                  {selectedFeedbackRow.teacherFeedbackStrengths?.trim() ? (
                    <p className="mt-1 text-[12px] text-slate-700">
                      <span className="font-medium">Strengths:</span>{" "}
                      {selectedFeedbackRow.teacherFeedbackStrengths.trim()}
                    </p>
                  ) : null}
                  {selectedFeedbackRow.teacherFeedbackImprovements?.trim() ? (
                    <p className="mt-1 text-[12px] text-slate-700">
                      <span className="font-medium">Areas to improve:</span>{" "}
                      {selectedFeedbackRow.teacherFeedbackImprovements.trim()}
                    </p>
                  ) : null}
                  {selectedFeedbackRow.teacherFeedbackNotes?.trim() ? (
                    <p className="mt-1 text-[12px] text-slate-700">
                      {selectedFeedbackRow.teacherFeedbackNotes.trim()}
                    </p>
                  ) : (
                    <p className="mt-1 text-[12px] text-slate-500">No detailed feedback for this demo yet.</p>
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="mb-4">
          <label
            htmlFor={`${id}-notes`}
            className="mb-1 block text-[12px] font-semibold text-slate-800"
          >
            Additional notes (institute)
          </label>
          <textarea
            id={`${id}-notes`}
            rows={4}
            className={cn(SX.textarea, "w-full")}
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Counselor or admin notes to include in the report…"
          />
        </section>

        <section className="mb-4">
          <label
            htmlFor={`${id}-rec`}
            className="mb-1 block text-[12px] font-semibold text-slate-800"
          >
            Recommendations for parents / student
          </label>
          <textarea
            id={`${id}-rec`}
            rows={4}
            className={cn(SX.textarea, "w-full")}
            value={recommendations}
            onChange={(e) => setRecommendations(e.target.value)}
            placeholder="Next steps, course fit, follow-up suggestions…"
          />
        </section>

        {genError ? (
          <p className="mb-3 text-[12px] text-red-700" role="alert">
            {genError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={generating}
            onClick={() => void generatePdf()}
          >
            {generating ? "Generating…" : "Generate PDF"}
          </button>
        </div>

        {previewSrc ? (
          <div className="mt-4 border border-slate-200 bg-slate-50/70 px-3 py-2.5">
            <p className="text-[12px] text-slate-700">
              PDF is generated and saved on this lead. Use preview button to open it in a new tab.
            </p>
            <div className="mt-2">
              <button
                type="button"
                className={SX.btnSecondary}
                onClick={() => window.open(previewSrc, "_blank", "noopener,noreferrer")}
              >
                Open preview in new tab
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Close
        </button>
        {previewSrc ? (
          <button
            type="button"
            className={SX.btnSecondary}
            onClick={() => window.open(previewSrc, "_blank", "noopener,noreferrer")}
          >
            Open preview
          </button>
        ) : null}
        {previewSrc ? (
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={confirmBusy}
            onClick={() => void confirmForSending()}
          >
            {confirmBusy ? "Saving…" : "Confirm for sending"}
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
