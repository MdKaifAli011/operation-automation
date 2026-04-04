"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import {
  LEAD_CSV_EXPORT_HEADERS,
  matrixToStringGrid,
  parseCsvText,
  parseLeadImportRows,
  type ParsedImportLead,
} from "@/lib/lead-csv";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type Props = {
  onImport: (leads: Lead[]) => void;
  /** First numeric id to use for imported rows (usually max existing id + 1). */
  nextStartId: number;
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

function assignIds(rows: ParsedImportLead[], startId: number): Lead[] {
  let n = startId;
  return rows.map((r) => ({ ...r, id: String(n++) }));
}

export function ImportExcelControl({ onImport, nextStartId }: Props) {
  const [open, setOpen] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ row: number; message: string }[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const clearFileSelection = useCallback(() => {
    setPickedName(null);
    setPickedFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

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
        setMessage("No rows were imported. Fix the issues below or check your headers.");
        setBusy(false);
        return;
      }
      const withIds = assignIds(parsed, nextStartId);
      onImport(withIds);
      const skipped = parseIssues.length;
      setMessage(
        `Imported ${parsed.length} lead${parsed.length === 1 ? "" : "s"}.${skipped ? ` ${skipped} row(s) skipped.` : ""}`,
      );
      clearFileSelection();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not read this file. Try CSV or a valid Excel workbook.",
      );
    } finally {
      setBusy(false);
    }
  }, [onImport, pickedFile, nextStartId, clearFileSelection]);

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          SX.leadBtnOutline,
          "h-9 gap-2 whitespace-nowrap px-3 text-[13px] font-semibold text-slate-800",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <UploadIcon className="text-slate-500" />
        Import Excel
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const f = e.target.files?.[0];
          setPickedName(f?.name ?? null);
          setPickedFile(f ?? null);
          setMessage(null);
          setIssues([]);
        }}
      />
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-1.5rem),22rem)] rounded-none border border-slate-200 bg-white p-4 text-slate-800 shadow-lg shadow-slate-900/10"
          role="dialog"
          aria-label="Import students from Excel or CSV"
        >
          <p className="text-[13px] font-semibold text-slate-900">
            Import leads (.csv, .xlsx, .xls)
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
            Header row is matched case-insensitively. Use the same names as
            export (lowercase), or common aliases like{" "}
            <span className="font-medium text-slate-700">Student</span>,{" "}
            <span className="font-medium text-slate-700">Mobile</span>,{" "}
            <span className="font-medium text-slate-700">Course</span> for
            targets.
          </p>
          <p className="mt-2 rounded-none border border-slate-100 bg-slate-50 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-slate-600">
            {LEAD_CSV_EXPORT_HEADERS.join(", ")}
          </p>
          <button
            type="button"
            className={cn(
              SX.btnSecondary,
              "mt-3 w-full justify-center rounded-none border-slate-200 py-2 text-[13px] font-medium",
            )}
            onClick={() => inputRef.current?.click()}
          >
            Choose file (.xlsx, .xls, .csv)
          </button>
          {pickedName ? (
            <p className="mt-2.5 rounded-none border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-2 text-[12px] text-emerald-900">
              <span className="font-medium">Selected: </span>
              <span className="break-all">{pickedName}</span>
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-slate-500">No file chosen yet.</p>
          )}
          {message && (
            <p
              className={cn(
                "mt-2 text-[12px]",
                message.startsWith("Imported")
                  ? "font-medium text-emerald-800"
                  : "text-rose-700",
              )}
              role="status"
            >
              {message}
            </p>
          )}
          {issues.length > 0 && (
            <ul
              className="mt-2 max-h-28 overflow-y-auto rounded-none border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-950"
              aria-label="Import warnings"
            >
              {issues.slice(0, 12).map((it, i) => (
                <li key={`${it.row}-${i}`}>
                  Row {it.row}: {it.message}
                </li>
              ))}
              {issues.length > 12 && (
                <li className="text-amber-800">…and {issues.length - 12} more</li>
              )}
            </ul>
          )}
          <button
            type="button"
            disabled={!pickedFile || busy}
            className={cn(
              SX.btnPrimary,
              "mt-3 w-full justify-center rounded-none py-2 text-[13px] font-medium",
              (!pickedFile || busy) && "cursor-not-allowed opacity-50",
            )}
            onClick={() => void runImport()}
          >
            {busy ? "Reading…" : "Import into leads"}
          </button>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Each row needs a student name and phone. Missing date defaults to
            today. Multiple targets: separate with commas (e.g.{" "}
            <code className="text-slate-600">NEET, JEE</code>). Optional columns:{" "}
            <span className="whitespace-normal">pipeline steps, sheet tab</span>
            — also matched case-insensitively.
          </p>
        </div>
      )}
    </div>
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
        d="M12 4v12m0 0l-4-4m4 4l4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
