"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";
import {
  listStudentReportFilesNewestFirst,
  type ReportFileListItem,
} from "@/lib/studentReportVersions";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import { prepareStudentReportEmailSentUpdate } from "@/lib/studentReportSendPayload";
import { PipelineMessageDialog } from "@/components/student/pipeline/PipelineMessageDialog";

function formatWhen(iso: string | null): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function sourceLabel(s: string | undefined): string {
  if (s === "manual_sales") return "Manual";
  if (s === "uploaded_custom") return "Upload";
  if (s === "teacher_feedback") return "Feedback";
  return s?.trim() || "—";
}

type Props = {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onPatchLead: (u: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
  onToast?: (message: string) => void;
};

export function StudentReportVersionsModal({
  open,
  onClose,
  lead,
  onPatchLead,
  refreshLead,
  onToast,
}: Props) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prevOpenRef = useRef(false);
  const sr = lead.pipelineMeta?.studentReport as
    | LeadPipelineStudentReport
    | undefined;
  const files = useMemo(() => listStudentReportFilesNewestFirst(sr), [sr]);

  const [selectedSendUrls, setSelectedSendUrls] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendingBusy, setSendingBusy] = useState(false);

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
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    const becameOpen = !prevOpenRef.current;
    prevOpenRef.current = true;
    if (becameOpen) {
      const newest = files[0]?.pdfUrl;
      setSelectedSendUrls(newest ? [newest] : []);
      setSendError(null);
    }
  }, [open, lead.id, files]);

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

  const toggleSendUrl = (pdfUrl: string) => {
    setSelectedSendUrls((prev) =>
      prev.includes(pdfUrl)
        ? prev.filter((u) => u !== pdfUrl)
        : [...prev, pdfUrl],
    );
  };

  const confirmDescription = useMemo(() => {
    if (selectedSendUrls.length === 0) return "";
    const lines = selectedSendUrls
      .map((u) => files.find((f) => f.pdfUrl === u)?.fileName ?? u)
      .join("\n");
    return `Send one email to the parent with ${selectedSendUrls.length} PDF link(s)?\n\n${lines}`;
  }, [selectedSendUrls, files]);

  const runSend = async (urls: string[]) => {
    if (urls.length === 0) return;
    setSendingBusy(true);
    setSendError(null);
    try {
      const now = new Date().toISOString();
      await sendLeadPipelineEmail(lead.id, {
        templateKey: "brochure",
        brochureEmail: {
          selectionKeys: [],
          includeStudentReportPdf: true,
          studentReportPdfUrls: urls,
        },
      });
      const { studentReportPartial, documentsItems, activityDescription } =
        prepareStudentReportEmailSentUpdate(lead, urls, now);
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          studentReport: studentReportPartial,
          documents: { items: documentsItems },
        }),
        activityLog: appendActivity(lead.activityLog, "brochure", activityDescription),
      });
      await refreshLead();
      onToast?.("Email sent.");
      setConfirmOpen(false);
      onClose();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSendingBusy(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <dialog
        ref={dialogRef}
        className={cn(
          "fixed left-1/2 top-1/2 z-240 w-[min(100vw-1rem,560px)] max-h-[min(88vh,640px)] -translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl",
          "backdrop:bg-slate-900/40 open:flex open:flex-col",
        )}
        onClose={onClose}
        aria-labelledby={`${id}-title`}
      >
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="min-w-0">
            <h3
              id={`${id}-title`}
              className="text-[15px] font-bold text-slate-900"
            >
              Report PDFs
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-600">
              Select files, send email, or add a new version.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {files.length === 0 ? (
            <p className="text-[13px] text-slate-600">
              No PDFs yet. Use New report to generate or upload.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {files.map((f: ReportFileListItem) => {
                const checked = selectedSendUrls.includes(f.pdfUrl);
                return (
                  <li
                    key={`${f.pdfUrl}-${f.generatedAt}`}
                    className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleSendUrl(f.pdfUrl)}
                      aria-label={`Select ${f.fileName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-900">
                        {f.fileName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatWhen(f.generatedAt)} · {sourceLabel(f.source)}
                        {f.isLatest ? " · Latest" : ""}
                      </p>
                    </div>
                    <a
                      href={f.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        SX.btnSecondary,
                        "shrink-0 px-2 py-1 text-[12px]",
                      )}
                    >
                      Open
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          {sendError ? (
            <p className="mt-2 text-[12px] text-red-700" role="alert">
              {sendError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
          <button type="button" className={SX.btnSecondary} onClick={onClose}>
            Close
          </button>
          {files.length > 0 ? (
            <button
              type="button"
              className={SX.btnPrimary}
              disabled={sendingBusy || selectedSendUrls.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              Send email
            </button>
          ) : null}
        </div>
      </dialog>

      {confirmOpen ? (
        <PipelineMessageDialog
          open
          onClose={() => setConfirmOpen(false)}
          variant="default"
          mode="confirm"
          title="Send report email?"
          description={confirmDescription}
          confirmLabel={sendingBusy ? "Sending…" : "Send"}
          cancelLabel="Cancel"
          onConfirm={() => {
            if (sendingBusy) return;
            void runSend([...selectedSendUrls]);
          }}
        />
      ) : null}
    </>
  );
}
