"use client";

import { format } from "date-fns";
import { useEffect, useId, useRef, useState } from "react";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import {
  LEAD_COUNTRY_OPTIONS,
  dialCodeForCountry,
  digitsOnly,
  normalizeDialCodeInput,
  optionForCountry,
  validateNationalNumber,
} from "@/lib/country-phone";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
};

const DEFAULT_COUNTRY = LEAD_COUNTRY_OPTIONS[0]!.value;
/** Defaults when the short form omits source / grade (API + grid). */
const DEFAULT_DATA_TYPE = "Organic";
const DEFAULT_GRADE = "12th";

export function AddStudentLeadDialog({
  open,
  onClose,
  onAdded,
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
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [dialCode, setDialCode] = useState(() =>
    dialCodeForCountry(DEFAULT_COUNTRY),
  );
  const [nationalNumber, setNationalNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [targetExams, setTargetExams] = useState<string[]>([
    TARGET_EXAM_OPTIONS[0],
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const nationalHint =
    optionForCountry(country)?.nationalHint ?? "Local number";

  const toggleTarget = (exam: string) => {
    setTargetExams((prev) => {
      if (prev.includes(exam)) {
        const next = prev.filter((x) => x !== exam);
        return next.length ? next : prev;
      }
      return [...prev, exam];
    });
  };

  const close = () => {
    ref.current?.close();
  };

  const submit = async () => {
    const name = studentName.trim();
    if (!name) {
      setError("Student name is required.");
      return;
    }
    const national = digitsOnly(nationalNumber);
    const phoneErr = validateNationalNumber(country, national);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (targetExams.length === 0) {
      setError("Select at least one target exam.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: format(new Date(), "yyyy-MM-dd"),
          followUpDate: null,
          studentName: name,
          parentName: parentName.trim() || "—",
          dataType: DEFAULT_DATA_TYPE,
          grade: DEFAULT_GRADE,
          targetExams: [...targetExams],
          country: country.trim() || DEFAULT_COUNTRY,
          phone: national,
          pipelineSteps: 0,
          rowTone: "new",
          sheetTab: "ongoing",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Could not create lead.",
        );
        return;
      }
      await onAdded();
      setStudentName("");
      setNationalNumber("");
      setDialCode(dialCodeForCountry(DEFAULT_COUNTRY));
      setParentName("");
      setTargetExams([TARGET_EXAM_OPTIONS[0]]);
      setCountry(DEFAULT_COUNTRY);
      close();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /** No `w-full` here — clsx does not merge Tailwind; stacking w-full broke narrow code input. */
  const inputBase =
    "box-border rounded-none border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";
  const fieldFull = cn(inputBase, "mt-1 w-full min-w-0 max-w-full");

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

      <div className="flex min-h-0 max-h-[min(70vh,520px)] flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
        <form
          id={formId}
          className="flex min-w-0 max-w-full flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="block min-w-0 text-[12px] font-medium text-slate-700">
            Student name <span className="text-rose-600">*</span>
            <input
              className={fieldFull}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              onFocus={() => setError(null)}
              placeholder="Full name, e.g. Aditya Kumar"
              autoComplete="name"
              autoFocus={open}
              required
            />
          </label>

          <label className="block min-w-0 text-[12px] font-medium text-slate-700">
            Country <span className="text-rose-600">*</span>
            <select
              className={cn(fieldFull, "cursor-pointer")}
              value={country}
              onChange={(e) => {
                const next = e.target.value;
                setCountry(next);
                setError(null);
                setDialCode(dialCodeForCountry(next));
              }}
            >
              {LEAD_COUNTRY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.dialCode})
                </option>
              ))}
            </select>
          </label>

          <div className="block min-w-0 text-[12px] font-medium text-slate-700">
            <span>
              Phone <span className="text-rose-600">*</span>
            </span>
            <p className="mb-1 text-[11px] font-normal text-slate-500">
              Code is set from country; change it if needed, then enter the local
              number.
            </p>
            <div
              className="mt-1 flex w-full min-w-0 max-w-full flex-nowrap items-stretch gap-2"
              role="group"
              aria-label="Phone number"
            >
              <label className="sr-only" htmlFor={`${formId}-dial`}>
                Country code
              </label>
              <input
                id={`${formId}-dial`}
                className={cn(
                  inputBase,
                  "mt-0 w-[4.25rem] shrink-0 tabular-nums sm:w-20",
                )}
                value={dialCode}
                onChange={(e) => {
                  setError(null);
                  setDialCode(normalizeDialCodeInput(e.target.value));
                }}
                onBlur={() => setDialCode(normalizeDialCodeInput(dialCode))}
                placeholder="+91"
                inputMode="tel"
                autoComplete="tel-country-code"
              />
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`${formId}-national`}>
                  Mobile number
                </label>
                <input
                  id={`${formId}-national`}
                  className={cn(inputBase, "mt-0 w-full min-w-0 tabular-nums")}
                  value={nationalNumber}
                  onChange={(e) => {
                    setError(null);
                    setNationalNumber(digitsOnly(e.target.value));
                  }}
                  onFocus={() => setError(null)}
                  placeholder={nationalHint}
                  inputMode="numeric"
                  autoComplete="tel-national"
                />
              </div>
            </div>
          </div>

          <label className="block min-w-0 text-[12px] font-medium text-slate-700">
            Parent / guardian
            <input
              className={fieldFull}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <fieldset className="min-w-0 border border-slate-200 p-3">
            <legend className="px-1 text-[12px] font-medium text-slate-700">
              Target exams
            </legend>
            <p className="mb-2 text-[11px] text-slate-500">
              Select one or more (e.g. JEE, NEET).
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGET_EXAM_OPTIONS.map((exam) => (
                <label
                  key={exam}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={targetExams.includes(exam)}
                    onChange={() => toggleTarget(exam)}
                    className="rounded border-slate-300"
                  />
                  {exam}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-[11px] leading-snug text-slate-500">
            New leads default to <span className="font-medium">Organic</span> source
            and <span className="font-medium">{DEFAULT_GRADE}</span> in the sheet —
            edit in the grid if needed.
          </p>
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
        <button
          type="submit"
          form={formId}
          disabled={submitting}
          className={cn(SX.btnPrimary, "px-4 py-2 disabled:opacity-50")}
        >
          {submitting ? "Saving…" : "Add to leads"}
        </button>
      </div>
    </dialog>
  );
}
