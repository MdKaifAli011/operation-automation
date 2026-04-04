"use client";

import { addDays, format } from "date-fns";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    reason: string;
    date: string;
    reminder: string;
    notes: string;
  }) => void;
};

const inputClass =
  "mt-1.5 w-full rounded-none border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 shadow-sm shadow-slate-900/[0.03] transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "text-[12px] font-medium text-slate-600";

const DEFAULT_REMINDER_TIME = "07:00";

export function FollowUpDialog({ open, onClose, onSubmit }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const defaultFollowUpStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

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
    const onBackdropMouseDown = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdropMouseDown);
    return () => dlg.removeEventListener("mousedown", onBackdropMouseDown);
  }, [open, onClose]);

  const close = () => {
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,720px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200/90 bg-white p-0",
        "shadow-2xl shadow-slate-900/15",
        "backdrop:bg-slate-900/45 backdrop:backdrop-blur-[3px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <form
        className="flex max-h-[min(90vh,720px)] flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          onSubmit({
            reason: String(fd.get("reason") ?? ""),
            date: String(fd.get("fdate") ?? ""),
            reminder: String(fd.get("reminder") ?? ""),
            notes: String(fd.get("notes") ?? ""),
          });
          ref.current?.close();
        }}
      >
        <div className="shrink-0 border-b border-slate-100 bg-gradient-to-br from-sky-50/90 via-white to-white px-6 pb-4 pt-5">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary"
              aria-hidden
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Schedule follow-up
              </h2>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col">
              <span className={labelClass}>Follow-up date</span>
              <input
                name="fdate"
                type="date"
                min={todayStr}
                defaultValue={defaultFollowUpStr}
                className={cn(inputClass, "tabular-nums")}
                required
              />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Reminder time</span>
              <input
                name="reminder"
                type="time"
                defaultValue={DEFAULT_REMINDER_TIME}
                className={cn(inputClass, "tabular-nums")}
              />
              <span className="mt-1 text-[11px] leading-snug text-slate-400">
                On the follow-up date above · default 7:00 AM
              </span>
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Follow-up reason</span>
              <textarea
                name="reason"
                rows={3}
                className={cn(inputClass, "min-h-[88px] resize-y")}
                placeholder="e.g. Fee discussion, parent callback, documents pending…"
              />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Quick notes</span>
              <input
                name="notes"
                className={inputClass}
                placeholder="Short context for next call"
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            className="rounded-none px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-none bg-success px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/15 transition-colors hover:bg-[#27692a]"
          >
            Save follow-up
          </button>
        </div>
      </form>
    </dialog>
  );
}
