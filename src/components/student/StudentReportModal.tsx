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

  const feedbackRows = demoRows.filter((r) =>
    Boolean(r.teacherFeedbackSubmittedAt?.trim()),
  );

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

  useEffect(() => {
    if (!open) return;
    setAdditionalNotes(sr?.additionalNotes ?? "");
    setRecommendations(sr?.recommendations ?? "");
    setGenError(null);
    setLocalPreviewUrl(sr?.pdfUrl?.trim() ? sr.pdfUrl : null);
  }, [open, lead.id, sr?.additionalNotes, sr?.recommendations, sr?.pdfUrl]);

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
        "fixed left-1/2 top-1/2 z-[220] w-[min(100vw-1rem,640px)] max-h-[min(92vh,900px)] -translate-x-1/2 -translate-y-1/2",
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
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
            Demo teacher feedback (read-only)
          </h3>
          {feedbackRows.length === 0 ? (
            <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
              No submitted feedback yet. After teachers submit demo forms, their
              responses will appear here and in the PDF.
            </p>
          ) : (
            <ul className="space-y-3">
              {feedbackRows.map((r, i) => (
                <li
                  key={r.meetRowId || `${r.isoDate}-${i}`}
                  className="rounded border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800"
                >
                  <p className="font-semibold text-slate-900">
                    {r.subject || "—"} · {r.teacher || "—"} · {r.isoDate || "—"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-600">
                    Overall: {ratingLabel(r.teacherFeedbackRating)}
                  </p>
                  {r.teacherFeedbackStrengths?.trim() ? (
                    <p className="mt-1 text-[12px]">
                      <span className="font-medium text-slate-700">
                        Strengths:{" "}
                      </span>
                      {r.teacherFeedbackStrengths.trim()}
                    </p>
                  ) : null}
                  {r.teacherFeedbackImprovements?.trim() ? (
                    <p className="mt-1 text-[12px]">
                      <span className="font-medium text-slate-700">
                        Areas to improve:{" "}
                      </span>
                      {r.teacherFeedbackImprovements.trim()}
                    </p>
                  ) : null}
                  {r.teacherFeedbackNotes?.trim() ? (
                    <p className="mt-1 text-[12px] text-slate-700">
                      {r.teacherFeedbackNotes.trim()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
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
          <div className="mt-4 border border-slate-200 bg-slate-50/80">
            <p className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Preview
            </p>
            <iframe
              title="Generated report PDF"
              className="h-[min(50vh,420px)] w-full bg-white"
              src={previewSrc}
            />
            <p className="px-3 py-2 text-[11px] text-slate-500">
              Saved on this lead. Use{" "}
              <span className="font-medium">Confirm for sending</span> when you are
              ready to share it with the family (then send via email or WhatsApp
              below).
            </p>
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
