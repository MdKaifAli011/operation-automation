"use client";

import { useEffect, useRef, useState } from "react";
import { downloadAllLeadCsvTemplateFile } from "@/lib/all-lead-csv";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";
import { DownloadIcon } from "./ExportAllLeadsDialog";
import { UploadIcon } from "./ImportAllLeadExcelControl";

type Props = {
  onImport: () => void;
  onExportCsv: () => void;
};

export function AllLeadActionsMenu({ onImport, onExportCsv }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className={cn(SX.leadToolbarIconBtn, "text-slate-700")}
        aria-expanded={open}
        aria-haspopup="menu"
        title="More actions"
        onClick={() => setOpen((v) => !v)}
      >
        <IconDotsVertical title="More actions" />
      </button>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-[100] mt-1 min-w-[14.5rem] rounded-none border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10",
          )}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onImport();
            }}
          >
            <UploadIcon className="shrink-0 text-slate-500" />
            Import Excel / CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              onExportCsv();
            }}
          >
            <DownloadIcon className="shrink-0 text-slate-500" />
            Export CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() => {
              setOpen(false);
              downloadAllLeadCsvTemplateFile();
            }}
          >
            <TemplateDocIcon className="shrink-0 text-slate-500" />
            CSV template
          </button>
        </div>
      ) : null}
    </div>
  );
}

function IconDotsVertical({ title }: { title?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-slate-600"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function TemplateDocIcon({ className }: { className?: string }) {
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
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h8M8 9h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
