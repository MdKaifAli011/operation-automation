"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";
import type { Lead } from "@/lib/types";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";
import {
  listStudentReportFiles,
  listStudentReportFilesNewestFirst,
} from "@/lib/studentReportVersions";
import { prepareStudentReportEmailSentUpdate } from "@/lib/studentReportSendPayload";
import { PipelineMessageDialog } from "@/components/student/pipeline/PipelineMessageDialog";

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
  "5",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
] as const;
const STUDENT_LEVEL_OPTIONS = [
  "Beginner",
  "Average",
  "Good",
  "Very Good",
  "Excellent",
] as const;

type ReportTab = "feedback" | "manual" | "upload";

type UiMode = "list" | "create";

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
  const prevOpenRef = useRef(false);
  const sr = lead.pipelineMeta?.studentReport as
    | LeadPipelineStudentReport
    | undefined;

  const demoRows: DemoTableRowPersisted[] =
    (lead.pipelineMeta?.demo as { rows?: DemoTableRowPersisted[] } | undefined)
      ?.rows ?? [];

  const [uiMode, setUiMode] = useState<UiMode>("list");
  const [reportTab, setReportTab] = useState<ReportTab>("feedback");
  const [genError, setGenError] = useState<string | null>(null);
  const [sendingBusy, setSendingBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedReportKey, setSelectedReportKey] = useState("");
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [manualAttempted, setManualAttempted] = useState<string>("20");
  const [manualCorrect, setManualCorrect] = useState<string>("10");
  const [manualLevel, setManualLevel] = useState<string>(
    STUDENT_LEVEL_OPTIONS[1] ?? "Average",
  );
  const [feedbackIncludeAssessment, setFeedbackIncludeAssessment] =
    useState<boolean>(false);
  const [feedbackAttempted, setFeedbackAttempted] = useState<string>("20");
  const [feedbackCorrect, setFeedbackCorrect] = useState<string>("10");
  const [feedbackLevel, setFeedbackLevel] = useState<string>(
    STUDENT_LEVEL_OPTIONS[3] ?? "Very Good",
  );
  const [selectedSendUrls, setSelectedSendUrls] = useState<string[]>([]);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const openedOnceRef = useRef(false);

  const allFilesNewestFirst = useMemo(
    () => listStudentReportFilesNewestFirst(sr),
    [sr],
  );
  const hasReports = allFilesNewestFirst.length > 0;

  useEffect(() => {
    if (!open) {
      openedOnceRef.current = false;
      prevOpenRef.current = false;
      return;
    }
    setGenError(null);
    setManualAttempted(sr?.manualQuestionsAttempted?.trim() || "20");
    setManualCorrect(sr?.manualCorrectAnswers?.trim() || "10");
    setManualLevel(
      sr?.manualStudentLevel?.trim() || STUDENT_LEVEL_OPTIONS[1] || "Average",
    );
    const becameOpen = !prevOpenRef.current;
    prevOpenRef.current = true;
    if (becameOpen) {
      const n = listStudentReportFiles(sr).length;
      setUiMode(n > 0 ? "list" : "create");
      const newest = listStudentReportFilesNewestFirst(sr)[0]?.pdfUrl;
      setSelectedSendUrls(newest ? [newest] : []);
    }
  }, [
    open,
    lead.id,
    sr?.pdfUrl,
    sr?.manualQuestionsAttempted,
    sr?.manualCorrectAnswers,
    sr?.manualStudentLevel,
    sr,
  ]);

  useEffect(() => {
    if (!open) return;
    if (openedOnceRef.current) return;
    openedOnceRef.current = true;
    const hasFb = demoRows.some((r) => hasTeacherFeedback(r));
    setReportTab(hasFb ? "feedback" : "manual");
  }, [open, demoRows]);

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

  const maxCorrect = Math.max(
    0,
    Number.parseInt(manualAttempted || "0", 10) || 0,
  );
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

  const toggleSendUrl = (pdfUrl: string) => {
    setSelectedSendUrls((prev) =>
      prev.includes(pdfUrl)
        ? prev.filter((u) => u !== pdfUrl)
        : [...prev, pdfUrl],
    );
  };

  const generateSelectedPdf = async () => {
    if (reportTab === "upload") return;

    if (reportTab === "feedback") {
      if (!selectedItem) {
        setGenError("Select a demo with faculty feedback.");
        return;
      }
      const meetRowId = selectedItem.row.meetRowId?.trim();
      if (!meetRowId) {
        setGenError(
          "Selected demo row is missing id. Save the row in Step 1 and retry.",
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
              manualQuestionsAttempted: feedbackIncludeAssessment
                ? feedbackAttempted
                : "",
              manualCorrectAnswers: feedbackIncludeAssessment
                ? feedbackCorrect
                : "",
              manualStudentLevel: feedbackIncludeAssessment ? feedbackLevel : "",
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          pdfUrl?: string;
        };
        if (!res.ok) throw new Error(data.error || "Could not generate PDF");
        await refreshLead();
        onToast?.("Report generated.");
        setUiMode("list");
        if (data.pdfUrl) setSelectedSendUrls([data.pdfUrl]);
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGeneratingKey(null);
      }
      return;
    }

    if (reportTab === "manual") {
      if (!manualAttempted || !manualLevel) {
        setGenError("Please complete manual inputs.");
        return;
      }
      const attemptedN = Number.parseInt(manualAttempted, 10);
      const correctN = Number.parseInt(manualCorrect, 10);
      if (!Number.isFinite(attemptedN) || attemptedN <= 0) {
        setGenError("Enter a valid number of questions attempted.");
        return;
      }
      if (!Number.isFinite(correctN) || correctN < 0 || correctN > attemptedN) {
        setGenError("Correct answers must be between 0 and questions attempted.");
        return;
      }
      setGeneratingKey("manual");
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
              meetRowId: "",
              manualQuestionsAttempted: manualAttempted,
              manualCorrectAnswers: manualCorrect,
              manualStudentLevel: manualLevel,
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          pdfUrl?: string;
        };
        if (!res.ok) throw new Error(data.error || "Could not generate PDF");
        await refreshLead();
        onToast?.("Report generated.");
        setUiMode("list");
        if (data.pdfUrl) setSelectedSendUrls([data.pdfUrl]);
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGeneratingKey(null);
      }
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
      const prevSr = sr;
      const oldUrl = String(prevSr?.pdfUrl ?? "").trim();
      const priorHist = Array.isArray(prevSr?.versionHistory)
        ? [...prevSr!.versionHistory!]
        : [];
      if (oldUrl) {
        priorHist.push({
          id: crypto.randomUUID(),
          pdfUrl: oldUrl,
          fileName: prevSr?.fileName ?? null,
          generatedAt: prevSr?.generatedAt ?? null,
          source: prevSr?.source,
          generatedForMeetRowId: prevSr?.generatedForMeetRowId ?? null,
        });
      }
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
            versionHistory: priorHist.slice(-40),
            activeSendPdfUrl: pdfUrl,
            activeSendFileName: fileName,
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "brochure",
          "Custom student report uploaded from report modal.",
        ),
      });
      await refreshLead();
      onToast?.("Report uploaded.");
      setUiMode("list");
      setSelectedSendUrls([pdfUrl]);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const runSendReport = async (urls: string[]) => {
    if (urls.length === 0) return;
    setSendingBusy(true);
    setGenError(null);
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
      setConfirmSendOpen(false);
      onClose();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setSendingBusy(false);
    }
  };

  const requestSendReport = () => {
    if (selectedSendUrls.length === 0) {
      setGenError("Select at least one report.");
      return;
    }
    setGenError(null);
    setConfirmSendOpen(true);
  };

  const confirmSendDescription = useMemo(() => {
    if (selectedSendUrls.length === 0) return "";
    const lines = selectedSendUrls
      .map((u) => {
        const hit = allFilesNewestFirst.find((f) => f.pdfUrl === u);
        return hit?.fileName ?? u;
      })
      .join("\n");
    return `Send one email to the parent with ${selectedSendUrls.length} PDF link(s)?\n\n${lines}`;
  }, [selectedSendUrls, allFilesNewestFirst]);

  return (
    <>
      <dialog
        ref={dialogRef}
        className={cn(
          "fixed left-1/2 top-1/2 z-220 w-[min(100vw-1rem,720px)] max-h-[min(92vh,880px)] -translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl",
          "backdrop:bg-black/45 open:flex open:flex-col",
        )}
        onClose={onClose}
        aria-labelledby={`${id}-title`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <div className="min-w-0">
            <h2
              id={`${id}-title`}
              className="text-[15px] font-bold tracking-tight text-slate-900"
            >
              Demo session report
            </h2>
            {uiMode === "list" ? (
              <p className="mt-0.5 text-[12px] text-slate-600">
                Select PDFs, then send by email.
              </p>
            ) : (
              <p className="mt-0.5 text-[12px] text-slate-600">
                Generate or upload — older files stay in the list.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {hasReports && uiMode === "create" ? (
              <button
                type="button"
                className={cn(SX.btnSecondary, "px-3 py-1.5 text-[12px]")}
                onClick={() => setUiMode("list")}
              >
                Back to list
              </button>
            ) : null}
            {hasReports && uiMode === "list" ? (
              <button
                type="button"
                className={cn(
                  SX.btnSecondary,
                  "border-sky-200 bg-sky-50 px-3 py-1.5 text-[12px] font-semibold text-sky-700 hover:bg-sky-100",
                )}
                onClick={() => setUiMode("create")}
              >
                New report
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {uiMode === "list" ? (
            <>
              <ul className="space-y-1.5">
                {allFilesNewestFirst.map((f) => {
                  const checked = selectedSendUrls.includes(f.pdfUrl);
                  return (
                    <li
                      key={f.pdfUrl}
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
                        <p className="truncate text-[13px] font-medium text-slate-900">
                          {f.fileName}
                        </p>
                        {f.generatedAt ? (
                          <p className="text-[11px] text-slate-500">
                            {new Date(f.generatedAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {f.isLatest ? " · Latest" : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={cn(
                          SX.btnSecondary,
                          "shrink-0 px-2 py-1 text-[12px]",
                        )}
                        onClick={() =>
                          window.open(f.pdfUrl, "_blank", "noopener,noreferrer")
                        }
                      >
                        Open
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-1 border border-slate-200 bg-slate-50 p-1">
                {(
                  [
                    ["feedback", "Feedback"],
                    ["manual", "Manual"],
                    ["upload", "Upload"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={cn(
                      "flex-1 min-w-[88px] px-2 py-2 text-[12px] font-semibold transition-colors",
                      reportTab === key
                        ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:bg-white/80",
                    )}
                    onClick={() => setReportTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {reportTab === "feedback" ? (
                <>
                  <section className="mb-4">
                    {reportItems.length === 0 ? (
                      <p className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                        No faculty feedback yet. Use Manual or Upload.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {reportItems.map((item) => {
                          const selected = item.key === selectedReportKey;
                          const hasFb = hasTeacherFeedback(item.row);
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
                                {hasFb ? (
                                  <span className="text-[10px] font-semibold text-sky-800">
                                    Ready
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600">
                                {item.row.isoDate || "—"} ·{" "}
                                {item.row.timeHmIST || "—"} ·{" "}
                                {item.row.subject || "—"}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {selectedItem ? (
                    <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2">
                      <p className="text-[12px] text-slate-700">
                        Overall:{" "}
                        {ratingLabel(selectedItem.row.teacherFeedbackRating)}
                      </p>
                    </section>
                  ) : null}

                  <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold text-slate-700">
                        Add assessment details (optional)
                      </p>
                      <button
                        type="button"
                        className={cn(
                          "rounded-none border px-2 py-1 text-[11px] font-semibold",
                          feedbackIncludeAssessment
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-700",
                        )}
                        onClick={() =>
                          setFeedbackIncludeAssessment((prev) => !prev)
                        }
                      >
                        {feedbackIncludeAssessment ? "Enabled" : "Enable"}
                      </button>
                    </div>

                    {feedbackIncludeAssessment ? (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="text-[12px] font-medium text-slate-700">
                          Attempted
                          <select
                            className={cn(SX.select, "mt-1 w-full")}
                            value={feedbackAttempted}
                            onChange={(e) => setFeedbackAttempted(e.target.value)}
                          >
                            {ATTEMPTED_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[12px] font-medium text-slate-700">
                          Correct
                          <select
                            className={cn(SX.select, "mt-1 w-full")}
                            value={feedbackCorrect}
                            onChange={(e) => setFeedbackCorrect(e.target.value)}
                          >
                            {correctOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[12px] font-medium text-slate-700">
                          Level
                          <select
                            className={cn(SX.select, "mt-1 w-full")}
                            value={feedbackLevel}
                            onChange={(e) => setFeedbackLevel(e.target.value)}
                          >
                            {STUDENT_LEVEL_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                  </section>

                  <div className="mb-4">
                    <button
                      type="button"
                      className={SX.btnPrimary}
                      disabled={!selectedItem || generatingKey !== null}
                      onClick={() => void generateSelectedPdf()}
                    >
                      {generatingKey ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </>
              ) : null}

              {reportTab === "manual" ? (
                <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="text-[12px] font-medium text-slate-700">
                      Attempted
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
                      Correct
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
                      Level
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
                  <div className="mt-3">
                    <button
                      type="button"
                      className={SX.btnPrimary}
                      disabled={generatingKey !== null}
                      onClick={() => void generateSelectedPdf()}
                    >
                      {generatingKey ? "Generating…" : "Generate"}
                    </button>
                  </div>
                </section>
              ) : null}

              {reportTab === "upload" ? (
                <section className="mb-4 border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                  <button
                    type="button"
                    className={SX.btnSecondary}
                    disabled={uploading}
                    onClick={() => uploadInputRef.current?.click()}
                  >
                    {uploading ? "Uploading…" : "Choose PDF"}
                  </button>
                </section>
              ) : null}
            </>
          )}

          {genError ? (
            <p className="mt-3 text-[12px] text-red-700" role="alert">
              {genError}
            </p>
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

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
          <button type="button" className={SX.btnSecondary} onClick={onClose}>
            Close
          </button>
          {uiMode === "list" && hasReports ? (
            <button
              type="button"
              className={SX.btnPrimary}
              disabled={sendingBusy || selectedSendUrls.length === 0}
              onClick={requestSendReport}
            >
              {sendingBusy ? "Sending…" : "Send email"}
            </button>
          ) : null}
        </div>
      </dialog>

      {confirmSendOpen ? (
        <PipelineMessageDialog
          open
          onClose={() => setConfirmSendOpen(false)}
          variant="default"
          mode="confirm"
          title="Send report email?"
          description={confirmSendDescription}
          confirmLabel={sendingBusy ? "Sending…" : "Send"}
          cancelLabel="Cancel"
          onConfirm={() => {
            if (sendingBusy) return;
            void runSendReport([...selectedSendUrls]);
          }}
        />
      ) : null}
    </>
  );
}
