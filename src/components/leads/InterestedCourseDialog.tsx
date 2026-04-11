"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Lead } from "@/lib/types";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

type Props = {
  lead: Lead | null;
  onClose: () => void;
  /** Called with chosen course/exam values (stored on `targetExams`). */
  onConfirm: (targetExams: string[]) => void;
};

export function InterestedCourseDialog({ lead, onClose, onConfirm }: Props) {
  const formId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const {
    activeValues: examValues,
    labelFor,
    loading,
  } = useTargetExamOptions();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lead) return;
    setSelected([...(lead.targetExams ?? [])]);
    setError(null);
  }, [lead]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (lead) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [lead, onClose]);

  const toggle = (value: string) => {
    setSelected((prev) =>
      prev.includes(value)
        ? prev.filter((x) => x !== value)
        : [...prev, value],
    );
    setError(null);
  };

  const submit = () => {
    if (selected.length === 0) {
      setError("Select at least one course or exam.");
      return;
    }
    onConfirm([...selected]);
  };

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[210] w-[min(100vw-1.5rem,26rem)] max-h-[min(90vh,480px)] -translate-x-1/2 -translate-y-1/2",
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
          className="text-[14px] font-bold tracking-tight text-slate-900"
        >
          Mark as interested
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          {lead ? (
            <>
              Choose a <span className="font-medium">course or exam</span> for{" "}
              <span className="font-medium text-slate-800">
                {lead.studentName}
              </span>
              . They move to <span className="font-medium">Ongoing (interested)</span>.
            </>
          ) : null}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3">
        {loading && examValues.length === 0 ? (
          <p className="text-[13px] text-slate-600">Loading options…</p>
        ) : examValues.length === 0 ? (
          <p className="text-[13px] text-amber-800">
            No target exams configured. Add them under{" "}
            <span className="font-medium">Settings → Exams and subjects</span>.
          </p>
        ) : (
          <fieldset className="min-w-0 border border-slate-200 p-3">
            <legend className="px-1 text-[12px] font-medium text-slate-700">
              Course / exam
            </legend>
            <p className="mb-2 text-[11px] text-slate-500">
              Select one or more (e.g. NEET, JEE). Shown under Courses in the ongoing
              table.
            </p>
            <div className="flex flex-wrap gap-2">
              {examValues.map((exam) => (
                <label
                  key={exam}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(exam)}
                    onChange={() => toggle(exam)}
                    className="rounded border-slate-300"
                  />
                  {labelFor(exam)}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {error && (
          <p className="mt-2 text-[12px] text-rose-700" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={cn(SX.btnPrimary, examValues.length === 0 && "opacity-50")}
          disabled={examValues.length === 0}
          onClick={submit}
        >
          Continue to ongoing
        </button>
      </div>
    </dialog>
  );
}
