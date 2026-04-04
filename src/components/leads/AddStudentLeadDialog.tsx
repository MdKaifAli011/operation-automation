"use client";

import { format } from "date-fns";
import { useEffect, useId, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import { COURSE_OPTIONS } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

const COUNSELLOR_PRESETS = ["Priya", "Arjun", "Ravi"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
  nextNumericId: number;
};

export function AddStudentLeadDialog({
  open,
  onClose,
  onAdd,
  nextNumericId,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const formId = useId();

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
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open, onClose]);

  const [studentName, setStudentName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentName, setParentName] = useState("");
  const [course, setCourse] = useState<string>(COURSE_OPTIONS[0]);
  const [country, setCountry] = useState("India");
  const [counsellor, setCounsellor] = useState<string>(COUNSELLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    ref.current?.close();
  };

  const submit = () => {
    const name = studentName.trim();
    if (!name) {
      setError("Student name is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone is required.");
      return;
    }
    const id = String(nextNumericId);
    const lead: Lead = {
      id,
      date: format(new Date(), "yyyy-MM-dd"),
      followUpDate: null,
      studentName: name,
      parentName: parentName.trim() || "—",
      counsellor,
      course,
      country: country.trim() || "India",
      phone: phone.replace(/\s+/g, ""),
      pipelineSteps: 0,
      rowTone: "new",
      sheetTab: "ongoing",
    };
    onAdd(lead);
    setStudentName("");
    setPhone("");
    setParentName("");
    setCourse(COURSE_OPTIONS[0]);
    setCountry("India");
    setCounsellor(COUNSELLOR_PRESETS[0]);
    setError(null);
    close();
  };

  const field =
    "mt-1 w-full rounded-none border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,24rem)] max-h-[min(90vh,640px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/15",
        "backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <h2 className="text-[15px] font-bold text-slate-900">Add student lead</h2>
        <p className="mt-0.5 text-[12px] text-slate-600">
          Creates a new row on the ongoing sheet. You can edit details in the grid
          or open their workspace.
        </p>
      </div>
      <div className="flex max-h-[min(70vh,520px)] flex-col overflow-y-auto px-4 py-4">
        <form
          id={formId}
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="block text-[12px] font-medium text-slate-700">
            Student name <span className="text-rose-600">*</span>
            <input
              className={field}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onFocus={() => setError(null)}
              placeholder="e.g. Aditya Kumar"
              autoComplete="name"
              autoFocus={open}
              required
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Phone <span className="text-rose-600">*</span>
            <input
              className={cn(field, "tabular-nums")}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={() => setError(null)}
              placeholder="10-digit mobile"
              inputMode="tel"
              required
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Parent / guardian
            <input
              className={field}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Course
            <select
              className={field}
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              {COURSE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Country
            <input
              className={field}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="India"
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Counsellor
            <select
              className={field}
              value={counsellor}
              onChange={(e) => setCounsellor(e.target.value)}
            >
              {COUNSELLOR_PRESETS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </form>
        {error && (
          <p className="mt-2 text-[12px] text-rose-700" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
        <button
          type="button"
          className={cn(SX.btnSecondary, "px-4 py-2")}
          onClick={() => close()}
        >
          Cancel
        </button>
        <button type="submit" form={formId} className={cn(SX.btnPrimary, "px-4 py-2")}>
          Add to leads
        </button>
      </div>
    </dialog>
  );
}
