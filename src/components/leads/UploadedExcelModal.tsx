"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

export type UploadedFile = {
  fileName: string;
  originalName: string | null;
  size: number;
  uploadedAt: string;
  fileUrl: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectFile: (file: UploadedFile) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function UploadedExcelModal({ open, onClose, onSelectFile }: Props) {
  const formId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    fetch("/api/uploads/excel-imports")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch files");
        const data = await res.json();
        if (!cancelled) setFiles(data.files || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load files");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, onClose]);

  const handleSelect = (file: UploadedFile) => {
    onSelectFile(file);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[210] w-[min(100vw-1.5rem,32rem)] max-h-[min(90vh,520px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200 bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={`${formId}-title`}
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3">
        <h2
          id={`${formId}-title`}
          className="text-[15px] font-bold tracking-tight text-slate-900"
        >
          Lead From Platform
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          Select a file (JSON, CSV, or Excel) to import leads. All uploaded files are shown.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="text-[13px] text-slate-600">Loading files…</span>
          </div>
        ) : error ? (
          <p className="rounded-none border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700" role="alert">
            {error}
          </p>
        ) : files.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[13px] text-slate-600">
              No uploaded files found.
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Upload files via API to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {files.length} file{files.length === 1 ? "" : "s"} available
            </p>
            <div className="space-y-2">
              {files.map((file) => (
                <button
                  key={file.fileName}
                  type="button"
                  onClick={() => handleSelect(file)}
                  className={cn(
                    "w-full rounded-none border border-slate-200 bg-white p-3 text-left",
                    "transition-colors hover:border-primary hover:bg-sky-50/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-slate-900">
                        {file.originalName || file.fileName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {formatDate(file.uploadedAt)} · {formatFileSize(file.size)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-medium text-primary">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
