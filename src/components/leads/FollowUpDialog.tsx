"use client";

import { addDays, format } from "date-fns";
import { useEffect, useRef } from "react";

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

  return (
    <dialog
      ref={ref}
      className="w-full max-w-md rounded-[6px] border border-[#e0e0e0] bg-white p-0 text-[#212121] shadow-none backdrop:bg-black/20"
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4 p-6"
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
          onClose();
        }}
      >
        <h2 className="text-lg font-semibold text-[#212121]">Set Follow-up</h2>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#757575]">Follow-up Reason</span>
          <textarea
            name="reason"
            rows={3}
            className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
            placeholder="Reason..."
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#757575]">Follow-up Date</span>
          <input
            name="fdate"
            type="date"
            min={todayStr}
            defaultValue={defaultFollowUpStr}
            className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#757575]">Reminder Time</span>
          <input
            name="reminder"
            type="time"
            className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[#757575]">Notes</span>
          <input
            name="notes"
            className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className="rounded-[6px] px-4 py-2 text-sm font-medium text-[#1565c0] hover:underline"
            onClick={() => {
              ref.current?.close();
              onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-[6px] bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#256628]"
          >
            Set Follow-up
          </button>
        </div>
      </form>
    </dialog>
  );
}
