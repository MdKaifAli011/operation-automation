"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

export function ImportExcelControl() {
  const [open, setOpen] = useState(false);
  const [pickedName, setPickedName] = useState<string | null>(null);
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
        }}
      />
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-1.5rem),20rem)] rounded-none border border-slate-200 bg-white p-4 text-slate-800 shadow-lg shadow-slate-900/10"
          role="dialog"
          aria-label="Import students from Excel"
        >
          <p className="text-[13px] font-semibold text-slate-900">
            Add students from a spreadsheet
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">
            Use an Excel or CSV export from your school CRM or admissions sheet.
            File upload will connect to your server in a later step — for now
            you can pick a file to see how it will work.
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
            <p className="mt-2 text-[11px] text-slate-500">
              No file chosen yet.
            </p>
          )}
          <button
            type="button"
            disabled
            className={cn(
              SX.btnPrimary,
              "mt-3 w-full cursor-not-allowed justify-center rounded-none py-2 opacity-50",
            )}
            title="Backend not connected yet"
          >
            Start import (coming soon)
          </button>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Tip: keep one row per student with columns like name, phone, course,
            and country — we’ll map these when the API is ready.
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
