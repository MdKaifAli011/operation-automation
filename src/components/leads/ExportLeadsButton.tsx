"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Lead, SheetTabId } from "@/lib/types";
import { leadsToExportCsv } from "@/lib/lead-csv";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

const SHEET_EXPORT_OPTIONS: {
  value: SheetTabId | "converted_full";
  label: string;
}[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "followup", label: "Follow-ups" },
  { value: "not_interested", label: "Not interested" },
  {
    value: "converted_full",
    label: "Converted (full pipeline)",
  },
];

function leadMatchesSheetExport(l: Lead, sheet: SheetTabId | "converted_full") {
  if (sheet === "converted_full") {
    return l.sheetTab === "converted" && l.pipelineSteps === 4;
  }
  return l.sheetTab === sheet;
}

function filterLeadsForExport(
  list: Lead[],
  opts: {
    dateFrom: string;
    dateTo: string;
    course: string;
    country: string;
    listFilterEnabled: boolean;
    sheet: SheetTabId | "converted_full";
  },
): Lead[] {
  return list.filter((l) => {
    if (opts.listFilterEnabled && !leadMatchesSheetExport(l, opts.sheet)) {
      return false;
    }
    if (opts.dateFrom && l.date < opts.dateFrom) return false;
    if (opts.dateTo && l.date > opts.dateTo) return false;
    if (opts.course && !l.targetExams.includes(opts.course)) return false;
    if (opts.country) {
      if (l.country.trim().toLowerCase() !== opts.country.trim().toLowerCase()) {
        return false;
      }
    }
    return true;
  });
}

type Props = {
  /** Full lead list — export modal applies its own filters on top. */
  leads: Lead[];
};

export function ExportLeadsButton({ leads }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [course, setCourse] = useState("");
  const [country, setCountry] = useState("");
  const [listFilterEnabled, setListFilterEnabled] = useState(false);
  const [sheet, setSheet] = useState<SheetTabId | "converted_full">("ongoing");

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
      if (e.target === dlg) setOpen(false);
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [open]);

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const l of leads) {
      const c = l.country?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const matchingLeads = useMemo(() => {
    if (dateFrom && dateTo && dateFrom > dateTo) return [];
    if (dateFrom && dateFrom > todayStr) return [];
    if (dateTo && dateTo > todayStr) return [];
    return filterLeadsForExport(leads, {
      dateFrom,
      dateTo,
      course,
      country,
      listFilterEnabled,
      sheet,
    });
  }, [
    leads,
    dateFrom,
    dateTo,
    todayStr,
    course,
    country,
    listFilterEnabled,
    sheet,
  ]);

  const rangeError =
    dateFrom && dateTo && dateFrom > dateTo
      ? "Start date must be on or before end date."
      : null;

  const futureDateError =
    (dateFrom && dateFrom > todayStr) || (dateTo && dateTo > todayStr)
      ? "Dates cannot be in the future — use today or earlier only."
      : null;

  const dateError = rangeError || futureDateError;

  /** Latest allowed “from” date: not after today, and not after “to” when set. */
  const fromDateMax =
    dateTo && dateTo <= todayStr ? dateTo : todayStr;

  const openDialog = () => {
    setDateFrom("");
    setDateTo("");
    setCourse("");
    setCountry("");
    setListFilterEnabled(false);
    setSheet("ongoing");
    setOpen(true);
  };

  const closeDialog = () => {
    ref.current?.close();
    setOpen(false);
  };

  const runExport = () => {
    if (dateError) return;
    const rows = matchingLeads;
    const csv = leadsToExportCsv(rows);
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sheetTag =
      listFilterEnabled
        ? sheet === "converted_full"
          ? "converted"
          : sheet
        : "all-lists";
    const tag = [
      sheetTag,
      dateFrom || "any",
      dateTo || "any",
      course || "all-courses",
      country ? country.replace(/\s+/g, "-") : "all-countries",
    ].join("_");
    a.download = `leads-export_${tag}_${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    closeDialog();
  };

  const field =
    "mt-1 w-full rounded-none border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";
  const label = "block text-[12px] font-medium text-slate-700";

  const canExport = !dateError && matchingLeads.length > 0;

  return (
    <>
      <button
        type="button"
        className={cn(
          SX.leadBtnOutline,
          "h-9 gap-2 whitespace-nowrap px-3 text-[13px] font-semibold text-slate-800",
        )}
        onClick={openDialog}
        title="Choose list (optional), dates, course, and country, then download CSV"
      >
        <DownloadIcon className="text-slate-500" />
        Export CSV
      </button>

      <dialog
        ref={ref}
        className={cn(
          "fixed left-1/2 top-1/2 z-[200] w-[min(100vw-1.5rem,26rem)] max-h-[min(92vh,720px)] -translate-x-1/2 -translate-y-1/2",
          "overflow-hidden rounded-none border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/15",
          "backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px]",
          "open:flex open:flex-col",
        )}
        onClose={() => setOpen(false)}
        aria-labelledby="export-leads-title"
      >
        <div className="border-b border-slate-100 bg-gradient-to-br from-sky-50/80 via-white to-white px-4 py-3">
          <div className="flex items-start gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none bg-primary/10 text-primary"
              aria-hidden
            >
              <DownloadIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="export-leads-title"
                className="text-[15px] font-bold tracking-tight text-slate-900"
              >
                Export leads to CSV
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-600">
                Optional list filter, then narrow by{" "}
                <span className="font-medium text-slate-700">intake date</span> (today or
                past only), target exam, and country. Leave dates empty to include all
                time. Headers match import (
                <code className="rounded bg-white/80 px-1 text-[11px] ring-1 ring-slate-200/80">
                  date, student name…
                </code>
                ).
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[min(60vh,480px)] overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
          <label
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-none border px-3 py-2.5 transition-colors",
              listFilterEnabled
                ? "border-primary/40 bg-sky-50/50"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80",
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded-none border-slate-300 text-primary focus:ring-primary"
              checked={listFilterEnabled}
              onChange={(e) => setListFilterEnabled(e.target.checked)}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-900">
                Limit export to one list
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
                Turn on to match a sheet tab (same buckets as Leads). Off =
                every list is included (still filtered by dates / course /
                country below).
              </p>
            </div>
          </label>

          <label
            className={cn(
              label,
              "mt-3 block",
              !listFilterEnabled && "pointer-events-none opacity-45",
            )}
          >
            Lead list
            <select
              className={field}
              value={sheet}
              disabled={!listFilterEnabled}
              onChange={(e) =>
                setSheet(e.target.value as SheetTabId | "converted_full")
              }
            >
              {SHEET_EXPORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4">
            <p className="text-[12px] font-medium text-slate-700">
              Intake date range
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Only <span className="font-medium text-slate-600">today and past</span> —
              future dates are disabled. Empty = no date limit on that side.
            </p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label className={label}>
                From
                <input
                  type="date"
                  className={field}
                  value={dateFrom}
                  max={fromDateMax}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className={label}>
                To
                <input
                  type="date"
                  className={field}
                  value={dateTo}
                  min={dateFrom || undefined}
                  max={todayStr}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </div>
          </div>
          {dateError && (
            <p className="mt-2 text-[12px] font-medium text-rose-700" role="alert">
              {dateError}
            </p>
          )}

          <label className={cn(label, "mt-4 block")}>
            Target exam
            <select
              className={field}
              value={course}
              onChange={(e) => setCourse(e.target.value)}
            >
              <option value="">All targets</option>
              {TARGET_EXAM_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className={cn(label, "mt-4 block")}>
            Country
            <select
              className={field}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700">
            <span className="font-semibold text-slate-900 tabular-nums">
              {matchingLeads.length}
            </span>
            {matchingLeads.length === 1
              ? " row matches"
              : " rows match"}
            {matchingLeads.length === 0 && !dateError && (
              <span className="block mt-1 text-[11px] text-slate-500">
                Widen filters or clear dates to include more leads.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            className={cn(SX.btnSecondary, "px-4 py-2")}
            onClick={() => closeDialog()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(SX.btnPrimary, "px-4 py-2")}
            disabled={!canExport}
            onClick={runExport}
          >
            Download CSV
          </button>
        </div>
      </dialog>
    </>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
        d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
