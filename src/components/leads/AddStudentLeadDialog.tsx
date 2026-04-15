"use client";

import { format } from "date-fns";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
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
import type { LeadSourceOption } from "@/lib/leadSources";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void | Promise<void>;
  /** From Settings → Lead sources (OL/WT/REF/PD). */
  leadSourceOptions?: LeadSourceOption[];
};

const DEFAULT_COUNTRY = LEAD_COUNTRY_OPTIONS[0]!.value;
const DEFAULT_GRADE = "12th";

export function AddStudentLeadDialog({
  open,
  onClose,
  onAdded,
  leadSourceOptions = [],
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const { activeValues: targetExamValues, labelFor: targetExamLabel } =
    useTargetExamOptions();

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
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [dialCode, setDialCode] = useState(() =>
    dialCodeForCountry(DEFAULT_COUNTRY),
  );
  const [nationalNumber, setNationalNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [targetExams, setTargetExams] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** After blur, show "required" if national number still empty. */
  const [nationalBlurredOnce, setNationalBlurredOnce] = useState(false);
  const [nationalFocused, setNationalFocused] = useState(false);
  const [dataType, setDataType] = useState(
    () => leadSourceOptions[0]?.value ?? "Organic",
  );

  useEffect(() => {
    if (!open) return;
    setDataType((prev) => {
      if (leadSourceOptions.some((o) => o.value === prev)) return prev;
      return leadSourceOptions[0]?.value ?? "Organic";
    });
    setNationalBlurredOnce(false);
    setNationalFocused(false);
  }, [open, leadSourceOptions]);

  useEffect(() => {
    if (targetExamValues.length === 0) return;
    setTargetExams((prev) =>
      prev.length === 0 ? [targetExamValues[0]!] : prev,
    );
  }, [targetExamValues]);

  const nationalDigits = useMemo(
    () => digitsOnly(nationalNumber),
    [nationalNumber],
  );

  const phoneFieldError = useMemo(() => {
    if (nationalDigits.length > 0) {
      return validateNationalNumber(country, nationalDigits);
    }
    if (nationalBlurredOnce && !nationalFocused) {
      return "Enter the phone number.";
    }
    return null;
  }, [
    country,
    nationalDigits,
    nationalBlurredOnce,
    nationalFocused,
  ]);

  const nationalHint =
    optionForCountry(country)?.nationalHint ?? "Local number";

  const emailTrimmed = email.trim();
  const emailError = useMemo(() => {
    if (!emailTrimmed) return null;
    if (emailTrimmed.length > 254) return "Email is too long.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      return "Enter a valid email address.";
    }
    return null;
  }, [emailTrimmed]);

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
      setNationalBlurredOnce(true);
      setError(null);
      return;
    }
    if (targetExams.length === 0) {
      setError("Select at least one target exam.");
      return;
    }
    if (emailError) {
      setError(emailError);
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
          dataType,
          grade: DEFAULT_GRADE,
          targetExams: [...targetExams],
          country: country.trim() || DEFAULT_COUNTRY,
          phone: national,
          parentEmail: emailTrimmed,
          email: emailTrimmed,
          pipelineSteps: 0,
          rowTone: "new",
          sheetTab: "today",
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
      setEmail("");
      setNationalNumber("");
      setDialCode(dialCodeForCountry(DEFAULT_COUNTRY));
      setParentName("");
      setTargetExams(
        targetExamValues.length > 0 ? [targetExamValues[0]!] : [],
      );
      setCountry(DEFAULT_COUNTRY);
      setDataType(leadSourceOptions[0]?.value ?? "Organic");
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
  const phoneFeedbackId = `${formId}-phone-feedback`;
  const phoneInvalid = Boolean(phoneFieldError);
  const phoneInputRing = phoneInvalid
    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200/80"
    : "";

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-200 w-[min(100vw-1.5rem,24rem)] max-h-[min(90vh,640px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/15",
        "backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
    >
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <h2 className="text-[15px] font-bold text-slate-900">Add student lead</h2>
        <p className="mt-0.5 text-[12px] text-slate-600">
          Creates a lead in <span className="font-medium">New &amp; Daily</span> on
          the Ongoing tab. Choose source, then edit in the grid or open their
          workspace.
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
            Parent email id
            <input
              type="email"
              className={cn(
                fieldFull,
                emailError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200/80" : "",
              )}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="Parent email id (optional)"
              autoComplete="email"
              inputMode="email"
              aria-invalid={Boolean(emailError)}
            />
            {emailError ? (
              <p className="mt-1 text-[11px] text-rose-700" role="alert">
                {emailError}
              </p>
            ) : null}
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
            <span id={`${formId}-phone-label`}>
              Phone <span className="text-rose-600">*</span>
            </span>

            <div
              className="mt-1 flex w-full min-w-0 max-w-full flex-nowrap items-stretch gap-2"
              role="group"
              aria-labelledby={`${formId}-phone-label`}
              aria-describedby={phoneFeedbackId}
              aria-invalid={phoneInvalid}
            >
              <label className="sr-only" htmlFor={`${formId}-dial`}>
                Country code
              </label>
              <input
                id={`${formId}-dial`}
                className={cn(
                  inputBase,
                  phoneInputRing,
                  "mt-0 w-17 shrink-0 tabular-nums sm:w-20",
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
                aria-invalid={phoneInvalid}
              />
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor={`${formId}-national`}>
                  Mobile number
                </label>
                <input
                  id={`${formId}-national`}
                  className={cn(
                    inputBase,
                    phoneInputRing,
                    "mt-0 w-full min-w-0 tabular-nums",
                  )}
                  value={nationalNumber}
                  onChange={(e) => {
                    setError(null);
                    setNationalNumber(digitsOnly(e.target.value));
                  }}
                  onFocus={() => {
                    setError(null);
                    setNationalFocused(true);
                  }}
                  onBlur={() => {
                    setNationalFocused(false);
                    setNationalBlurredOnce(true);
                  }}
                  placeholder={nationalHint}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  aria-invalid={phoneInvalid}
                  aria-errormessage={
                    phoneFieldError ? phoneFeedbackId : undefined
                  }
                />
              </div>
            </div>
            <p
              id={phoneFeedbackId}
              className={cn(
                "mt-1 text-[11px]",
                phoneFieldError ? "text-rose-700" : "text-slate-500",
              )}
              role={phoneFieldError ? "alert" : undefined}
              aria-live={phoneFieldError ? "polite" : undefined}
            >
              {phoneFieldError ?? `Expected: ${nationalHint}.`}
            </p>
          </div>

          <label className="block min-w-0 text-[12px] font-medium text-slate-700">
            Parent name
            <input
              className={fieldFull}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="block min-w-0 text-[12px] font-medium text-slate-700">
            Source <span className="text-rose-600">*</span>
            <select
              className={cn(
                inputBase,
                "mt-0.5 w-full min-w-0 max-w-full cursor-pointer",
              )}
              value={dataType}
              onChange={(e) => {
                setDataType(e.target.value);
                setError(null);
              }}
              aria-label="Lead source"
            >
              {leadSourceOptions.map((o) => (
                <option key={`${o.abbrev}-${o.value}`} value={o.value}>
                  {o.abbrev} — {o.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
              Settings → Lead sources
            </p>
          </label>

          <fieldset className="min-w-0 border border-slate-200 p-3">
            <legend className="px-1 text-[12px] font-medium text-slate-700">
              Target exams
            </legend>
            <p className="mb-2 text-[11px] text-slate-500">
              Select one or more (e.g. JEE, NEET).
            </p>
            <div className="flex flex-wrap gap-2">
              {targetExamValues.map((exam) => (
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
                  {targetExamLabel(exam)}
                </label>
              ))}
            </div>
          </fieldset>

       
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
