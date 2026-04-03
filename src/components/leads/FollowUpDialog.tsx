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
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 shadow-sm shadow-slate-900/[0.03] transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const labelClass = "text-[12px] font-medium text-slate-600";

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

  const close = () => {
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,720px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-0",
        "shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/[0.06]",
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg"
              aria-hidden
            >
              📅
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Schedule follow-up
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
                Set when to call back and optional reminder — saved with this lead.
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
          <div className="flex flex-col gap-4">
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
              <span className={labelClass}>Follow-up date</span>
              <input
                name="fdate"
                type="date"
                min={todayStr}
                defaultValue={defaultFollowUpStr}
                className={cn(inputClass, "tabular-nums")}
              />
            </label>
            <label className="flex flex-col">
              <span className={labelClass}>Reminder time</span>
              <input
                name="reminder"
                type="time"
                className={cn(inputClass, "tabular-nums")}
              />
              <span className="mt-1 text-[11px] text-slate-400">
                Optional — team calendar reminder
              </span>
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
            className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-200/80 hover:text-slate-900"
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-success px-5 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-emerald-900/15 transition-colors hover:bg-[#27692a]"
          >
            Save follow-up
          </button>
        </div>
      </form>
    </dialog>
  );
}
