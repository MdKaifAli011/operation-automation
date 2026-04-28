"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  LEAD_CSV_EXPORT_HEADERS,
  matrixToStringGrid,
  parseCsvText,
  parseLeadImportRows,
  type ParsedImportLead,
} from "@/lib/lead-csv";
import { formatTargetExams } from "@/lib/lead-display";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

export type ImportExcelControlHandle = {
  open: () => void;
};

type Props = {
  /** Refetch leads after a successful import. */
  onImported: () => void | Promise<void>;
  /**
   * When false, the outline trigger is hidden; open the dialog via ref
   * `open()` (e.g. from the leads ⋮ menu).
   */
  showTriggerButton?: boolean;
};

type ParseIssue = { row: number; message: string };

type PreviewState = {
  leads: ParsedImportLead[];
  issues: ParseIssue[];
};

async function fileToGrid(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  const buf = await file.arrayBuffer();
  const XLSX = await import("@e965/xlsx");
  const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<(string | number | null | undefined)[]>(
    sheet,
    { header: 1, defval: "", raw: false },
  );
  return matrixToStringGrid(aoa);
}

const field =
  "mt-1.5 w-full rounded-none border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 shadow-sm shadow-slate-900/[0.03] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export const ImportExcelControl = forwardRef<
  ImportExcelControlHandle,
  Props
>(function ImportExcelControl(
  { onImported, showTriggerButton = true },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) d.showModal();
    else d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg && !busy) setOpen(false);
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, busy]);

  useEffect(() => {
    if (!pickedFile) {
      setPreview(null);
      setParseError(null);
      setParsing(false);
      return;
    }
    let cancelled = false;
    setParsing(true);
    setParseError(null);
    void (async () => {
      try {
        const grid = await fileToGrid(pickedFile);
        const { leads, issues } = parseLeadImportRows(grid);
        if (!cancelled) {
          setPreview({ leads, issues });
        }
      } catch (e) {
        if (!cancelled) {
          setPreview(null);
          setParseError(
            e instanceof Error
              ? e.message
              : "Could not read this file. Try CSV or Excel.",
          );
        }
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickedFile]);

  const resetForm = useCallback(() => {
    setPickedName(null);
    setPickedFile(null);
    setPreview(null);
    setParseError(null);
    setParsing(false);
    setMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Listen for import-excel-file event from UploadedExcelModal
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ fileUrl: string; fileName: string }>;
      const { fileUrl, fileName } = ce.detail;

      // Fetch the file from the URL and create a File object
      fetch(fileUrl)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch file");
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: blob.type });

          // Open dialog and set the file
          resetForm();
          setPickedFile(file);
          setPickedName(fileName);
          setOpen(true);
        })
        .catch((err) => {
          console.error("Failed to load uploaded file:", err);
          setMessage("Failed to load uploaded file. Please try again.");
          setOpen(true);
        });
    };

    window.addEventListener("import-excel-file", handler);
    return () => window.removeEventListener("import-excel-file", handler);
  }, [resetForm]);

  const openDialog = useCallback(() => {
    resetForm();
    setOpen(true);
  }, [resetForm]);

  useImperativeHandle(
    ref,
    () => ({
      open: openDialog,
    }),
    [openDialog],
  );

  const closeDialog = () => {
    if (busy) return;
    dialogRef.current?.close();
    setOpen(false);
    resetForm();
  };

  const runImport = useCallback(async () => {
    if (!preview || preview.leads.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/leads/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: preview.leads }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setMessage(
          typeof body?.error === "string"
            ? body.error
            : `Import failed (${res.status}). Check MongoDB connection and try again.`,
        );
        setBusy(false);
        return;
      }
      await onImported();
      const skipped = preview.issues.length;
      setMessage(
        `Imported ${preview.leads.length} lead${preview.leads.length === 1 ? "" : "s"}.${skipped ? ` ${skipped} row(s) had warnings (see above).` : ""}`,
      );
      setPickedName(null);
      setPickedFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Import request failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [onImported, preview]);

  const issues = preview?.issues ?? [];
  const canImport =
    !parsing &&
    !parseError &&
    preview &&
    preview.leads.length > 0 &&
    !busy;

  return (
    <>
      {showTriggerButton ? (
        <button
          type="button"
          className={cn(
            SX.leadBtnOutline,
            "h-9 gap-1.5 px-3 text-[13px] font-semibold text-slate-800",
          )}
          onClick={openDialog}
          title="Upload CSV or Excel — preview rows, then confirm import"
        >
          <UploadIcon className="text-slate-500" />
          Import Excel / CSV
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        className={cn(
          "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-0.75rem,48rem)] max-h-[min(92vh,760px)] -translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/15",
          "backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]",
          "open:flex open:flex-col",
        )}
        onClose={() => {
          if (!busy) resetForm();
          setOpen(false);
        }}
        aria-labelledby="import-leads-title"
      >
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-br from-emerald-50/80 via-white to-white px-4 py-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-emerald-100/90 text-emerald-800"
              aria-hidden
            >
              <UploadIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="import-leads-title"
                className="text-[15px] font-bold tracking-tight text-slate-900"
              >
                Import leads
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                Choose a file → we show a <span className="font-medium">preview</span> of
                rows to save. Confirm to write to the database. Use{" "}
                <span className="font-medium">CSV template</span>; empty cells get defaults.
                Headers:{" "}
                <code className="rounded bg-white/80 px-1 text-[11px] ring-1 ring-slate-200/80">
                  {LEAD_CSV_EXPORT_HEADERS.slice(0, 3).join(", ")}
                </code>
                …
              </p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            aria-label="Choose CSV or Excel file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPickedFile(f);
                setPickedName(f.name);
                setMessage(null);
              }
            }}
          />
          <button
            type="button"
            className={cn(
              field,
              "flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed py-5 text-center transition-colors hover:border-primary/50 hover:bg-sky-50/40",
            )}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="text-[13px] font-semibold text-slate-800">
              {pickedName ? pickedName : "Click to choose file"}
            </span>
            <span className="text-[11px] text-slate-500">
              .csv, .xlsx, or .xls
            </span>
          </button>

          {pickedName && (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setPickedName(null);
                setPickedFile(null);
                setPreview(null);
                if (inputRef.current) inputRef.current.value = "";
                setMessage(null);
                setParseError(null);
              }}
              disabled={busy}
            >
              Remove file
            </button>
          )}

          {parsing && (
            <p className="mt-4 text-[13px] text-slate-600" role="status">
              Reading file…
            </p>
          )}

          {parseError && (
            <p
              className="mt-4 rounded-none border border-rose-200 bg-rose-50/90 px-3 py-2 text-[12px] text-rose-950"
              role="alert"
            >
              {parseError}
            </p>
          )}

          {preview && !parsing && (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <p className="text-[13px] font-semibold text-slate-900">
                  Preview — rows to import
                </p>
                <p className="text-[12px] tabular-nums text-slate-600">
                  <span className="font-semibold text-slate-800">
                    {preview.leads.length}
                  </span>{" "}
                  lead{preview.leads.length === 1 ? "" : "s"}
                  {issues.length > 0 && (
                    <span className="text-amber-800">
                      {" "}
                      · {issues.length} warning{issues.length === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </div>

              {preview.leads.length === 0 ? (
                <p className="text-[13px] text-slate-600" role="status">
                  No data rows found. Check the header row matches the template and at least
                  one row has content.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-none border border-slate-200 bg-white">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Student</th>
                        <th className="px-2 py-2">Phone</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Grade</th>
                        <th className="px-2 py-2">Country</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Targets</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-800">
                      {preview.leads.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="px-2 py-1.5 tabular-nums text-slate-500">
                            {i + 1}
                          </td>
                          <td className="max-w-[140px] truncate px-2 py-1.5 font-medium">
                            {row.studentName}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                            {row.phone || "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                            {row.date}
                          </td>
                          <td className="px-2 py-1.5">{row.grade}</td>
                          <td className="max-w-[100px] truncate px-2 py-1.5">
                            {row.country}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5">
                            {row.rowTone}
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-1.5 text-slate-600">
                            {formatTargetExams(row.targetExams)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {issues.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                    Warnings (row still imported if listed above)
                  </p>
                  <ul className="mt-1.5 max-h-28 overflow-y-auto rounded-none border border-amber-100 bg-amber-50/60 px-2 py-2 text-[11px] text-amber-950 [scrollbar-width:thin]">
                    {issues.map((it, i) => (
                      <li
                        key={i}
                        className="border-b border-amber-100/80 py-1 last:border-0"
                      >
                        <span className="font-semibold tabular-nums">
                          Row {it.row}:
                        </span>{" "}
                        {it.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {message && (
            <p
              className={cn(
                "mt-4 rounded-none border px-3 py-2 text-[12px] leading-snug",
                message.startsWith("Imported")
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : message.includes("No rows were imported")
                    ? "border-amber-200 bg-amber-50/90 text-amber-950"
                    : "border-rose-200 bg-rose-50/90 text-rose-950",
              )}
              role={message.startsWith("Imported") ? "status" : "alert"}
            >
              {message}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            className={cn(SX.btnSecondary, "px-4 py-2")}
            onClick={closeDialog}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(SX.leadBtnGreen, "px-4 py-2 text-[13px] font-semibold")}
            disabled={!canImport}
            onClick={() => void runImport()}
          >
            {busy
              ? "Saving…"
              : preview && preview.leads.length > 0
                ? `Import ${preview.leads.length} lead${preview.leads.length === 1 ? "" : "s"}`
                : "Import"}
          </button>
        </div>
      </dialog>
    </>
  );
});

export function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M12 3v10m0 0l-4-4m4 4l4-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
