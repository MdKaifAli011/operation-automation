"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LEAD_CSV_EXPORT_HEADERS,
  matrixToStringGrid,
  parseCsvText,
  parseLeadImportRows,
} from "@/lib/lead-csv";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type Props = {
  /** Refetch leads after a successful import. */
  onImported: () => void | Promise<void>;
};

async function fileToGrid(file: File): Promise<string[][]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = await file.text();
    return parseCsvText(text);
  }
  const buf = await file.arrayBuffer();
  const XLSX = await import("xlsx");
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

export function ImportExcelControl({ onImported }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ row: number; message: string }[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) d.showModal();
    else d.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg && !busy) setOpen(false);
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, busy]);

  const resetForm = useCallback(() => {
    setPickedName(null);
    setPickedFile(null);
    setMessage(null);
    setIssues([]);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const openDialog = () => {
    resetForm();
    setOpen(true);
  };

  const closeDialog = () => {
    if (busy) return;
    ref.current?.close();
    setOpen(false);
    resetForm();
  };

  const runImport = useCallback(async () => {
    if (!pickedFile) return;
    setBusy(true);
    setMessage(null);
    setIssues([]);
    try {
      const grid = await fileToGrid(pickedFile);
      const { leads: parsed, issues: parseIssues } = parseLeadImportRows(grid);
      setIssues(parseIssues);
      if (parsed.length === 0) {
        setMessage(
          "No rows were imported. Fix the issues below or check your headers.",
        );
        setBusy(false);
        return;
      }
      const res = await fetch("/api/leads/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          typeof body?.error === "string"
            ? body.error
            : "Import failed. Check API and database.",
        );
        setBusy(false);
        return;
      }
      await onImported();
      const skipped = parseIssues.length;
      setMessage(
        `Imported ${parsed.length} lead${parsed.length === 1 ? "" : "s"}.${skipped ? ` ${skipped} row(s) skipped.` : ""}`,
      );
      setPickedName(null);
      setPickedFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not read this file. Try CSV or a valid Excel workbook.",
      );
    } finally {
      setBusy(false);
    }
  }, [onImported, pickedFile]);

  return (
    <>
      <button
        type="button"
        className={cn(
          SX.leadBtnOutline,
          "h-9 gap-1.5 px-3 text-[13px] font-semibold text-slate-800",
        )}
        onClick={openDialog}
        title="Upload CSV or Excel — headers must match export format"
      >
        <UploadIcon className="text-slate-500" />
        Import Excel / CSV
      </button>

      <dialog
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,26rem)] max-h-[min(92vh,720px)] -translate-x-1/2 -translate-y-1/2",
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
                First row = column headers (
                <code className="rounded bg-white/80 px-1 text-[11px] ring-1 ring-slate-200/80">
                  {LEAD_CSV_EXPORT_HEADERS.slice(0, 3).join(", ")}
                </code>
                …). CSV or Excel (first sheet). Rows are saved to the database.
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
                setIssues([]);
              }
            }}
          />
          <button
            type="button"
            className={cn(
              field,
              "flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 border-dashed py-6 text-center transition-colors hover:border-primary/50 hover:bg-sky-50/40",
            )}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <span className="text-[13px] font-semibold text-slate-800">
              {pickedName ? pickedName : "Click to choose file"}
            </span>
            <span className="text-[11px] text-slate-500">
              .csv, .xlsx, or .xls · max practical size ~10MB
            </span>
          </button>

          {pickedName && (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setPickedName(null);
                setPickedFile(null);
                if (inputRef.current) inputRef.current.value = "";
                setMessage(null);
                setIssues([]);
              }}
              disabled={busy}
            >
              Remove file
            </button>
          )}

          {message && (
            <p
              className={cn(
                "mt-4 rounded-none border px-3 py-2 text-[12px]",
                message.startsWith("Imported")
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-800",
              )}
              role="status"
            >
              {message}
            </p>
          )}

          {issues.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-800">
                Row issues
              </p>
              <ul className="mt-1.5 max-h-[min(28vh,200px)] overflow-y-auto rounded-none border border-rose-100 bg-rose-50/50 px-2 py-2 text-[11px] text-rose-900 [scrollbar-width:thin]">
                {issues.map((it, i) => (
                  <li key={i} className="border-b border-rose-100/80 py-1.5 last:border-0">
                    <span className="font-semibold tabular-nums">Row {it.row}:</span>{" "}
                    {it.message}
                  </li>
                ))}
              </ul>
            </div>
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
            disabled={!pickedFile || busy}
            onClick={() => void runImport()}
          >
            {busy ? "Importing…" : "Run import"}
          </button>
        </div>
      </dialog>
    </>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
