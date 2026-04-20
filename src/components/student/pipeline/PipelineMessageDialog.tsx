"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type Base = {
  open: boolean;
  onClose: () => void;
  /** Error = red title bar (system alerts); default = slate header */
  variant: "default" | "error";
  title: string;
  /** Primary copy under the title */
  description: string;
  /** Muted box (e.g. class summary) - can be string or structured object */
  highlight?: string | Record<string, string>;
  /** Smaller lines below highlight (e.g. contact) - can be string or structured object */
  meta?: string | Record<string, string>;
};

export type PipelineMessageDialogProps =
  | (Base & {
      mode: "alert";
      okLabel?: string;
      description: string;
      highlight?: string | Record<string, string>;
      meta?: string | Record<string, string>;
      onConfirm: () => void;
    })
  | (Base & {
      mode: "confirm";
      title: string;
      description: string;
      highlight?: string | Record<string, string>;
      meta?: string | Record<string, string>;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: () => void;
      loading?: boolean;
    });

export function PipelineMessageDialog(props: PipelineMessageDialogProps) {
  const { open, onClose, variant, title, description, highlight, meta, mode } = props;
  const { confirmLabel, cancelLabel, onConfirm, loading } = props as any;
  const ref = useRef<HTMLDialogElement>(null);

  // Helper to render structured data in grid layout
  const renderStructuredData = (data: Record<string, string>) => {
    return (
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {Object.entries(data).map(([label, value]) => (
          <React.Fragment key={label}>
            <div className="text-[12px] text-slate-500 font-medium">{label}</div>
            <div className="text-[13px] font-medium text-slate-800 break-all">
              {value || "—"}
            </div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open) {
      d.showModal();
    } else {
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

  const close = () => {
    onClose();
  };

  const headerClass =
    variant === "error"
      ? "bg-[#c62828] text-white"
      : "border-b border-slate-200 bg-slate-50 text-slate-900";

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[250] w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,640px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200/90 bg-white p-0",
        "shadow-2xl shadow-slate-900/20",
        "backdrop:bg-slate-900/50 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 px-4 py-3",
          headerClass,
        )}
      >
        <h2 className="text-[15px] font-bold leading-snug tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-none border px-2 py-0.5 text-lg leading-none transition-colors",
            variant === "error"
              ? "border-white/40 text-white hover:bg-white/10"
              : "border-slate-200 text-slate-600 hover:bg-slate-100",
          )}
          aria-label="Close"
          onClick={close}
        >
          ×
        </button>
      </div>
      <div className="max-h-[min(60vh,420px)] overflow-y-auto px-4 py-4">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
          {description}
        </p>
        {highlight ? (
          typeof highlight === 'string' ? (
            <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-medium text-slate-800">
              {highlight}
            </div>
          ) : (
            <div className="mt-4 border border-slate-200 bg-slate-50 rounded-lg px-4 py-3">
              {renderStructuredData(highlight)}
            </div>
          )
        ) : null}
        {meta ? (
          typeof meta === 'string' ? (
            <p className="mt-3 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600">
              {meta}
            </p>
          ) : (
            <div className="mt-4 border border-slate-200 bg-slate-50 rounded-lg px-4 py-3">
              {renderStructuredData(meta)}
            </div>
          )
        ) : null}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
        {props.mode === "alert" ? (
          <button
            type="button"
            className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            onClick={close}
          >
            {props.okLabel ?? "OK"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={close}
            >
              {props.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-[13px] font-medium text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={() => {
                props.onConfirm();
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018 8 0 018 8 0 01-4.58 4.58l-1.46 1.46a2 2 0 012.84 2.84 012.84 2.84 014.58-4.58L18 16l-4.58-4.58a2 2 0 01-2.84-2.84 012.84-2.84 014.58 2.84L6 8l4.58 4.58a2 2 0 012.84-2.84 012.84 2.84 014.58-2.84L18 16z"
                    />
                  </svg>
                  Processing...
                </>
              ) : (
                props.confirmLabel
              )}
            </button>
          </>
        )}
      </div>
    </dialog>
  );
}
