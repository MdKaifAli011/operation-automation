"use client";

import { format, isSameMonth, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { formatTargetExams } from "@/lib/lead-display";
import type { FeeRecord, Lead } from "@/lib/types";

type EnrollPayload = {
  leads: Lead[];
  fees: FeeRecord[];
};

const ENROLL_PAGE_CACHE_TTL_MS = 60_000;
let enrollPageCache: { data: EnrollPayload; fetchedAt: number } | null = null;
let enrollPageInFlight: Promise<EnrollPayload> | null = null;

function hasFreshEnrollPageCache() {
  if (!enrollPageCache) return false;
  return Date.now() - enrollPageCache.fetchedAt < ENROLL_PAGE_CACHE_TTL_MS;
}

function writeEnrollPageCache(data: EnrollPayload) {
  enrollPageCache = { data, fetchedAt: Date.now() };
}

async function fetchEnrollPageFromApi() {
  const [lr, fr] = await Promise.all([fetch("/api/leads"), fetch("/api/fees")]);
  if (!lr.ok) throw new Error("Could not load leads.");
  if (!fr.ok) throw new Error("Could not load fee records.");
  const leadData = (await lr.json()) as Lead[];
  const feeData = (await fr.json()) as FeeRecord[];
  return {
    leads: Array.isArray(leadData) ? leadData : [],
    fees: Array.isArray(feeData) ? feeData : [],
  };
}

async function getEnrollPageCached(force = false) {
  if (!force && hasFreshEnrollPageCache() && enrollPageCache) {
    return enrollPageCache.data;
  }
  if (!force && enrollPageInFlight) return enrollPageInFlight;
  enrollPageInFlight = fetchEnrollPageFromApi()
    .then((data) => {
      writeEnrollPageCache(data);
      return data;
    })
    .finally(() => {
      enrollPageInFlight = null;
    });
  return enrollPageInFlight;
}

function safeFormatLeadDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

export default function EnrollStudentPage() {
  const {
    activeValues: targetExamValues,
    labelFor: targetExamLabel,
    loading: targetExamsLoading,
  } = useTargetExamOptions();
  const [leads, setLeads] = useState<Lead[]>(() => enrollPageCache?.data.leads ?? []);
  const [fees, setFees] = useState<FeeRecord[]>(() => enrollPageCache?.data.fees ?? []);
  const [loading, setLoading] = useState(() => !enrollPageCache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await getEnrollPageCached(force);
      setLeads(data.leads);
      setFees(data.fees);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setLeads([]);
      setFees([]);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFreshEnrollPageCache() && enrollPageCache) {
      setLeads(enrollPageCache.data.leads);
      setFees(enrollPageCache.data.fees);
      setLoading(false);
      return;
    }
    void load({ force: true, showLoading: !enrollPageCache });
  }, [load]);

  const enrolled = useMemo(
    () => leads.filter((l) => l.sheetTab === "converted"),
    [leads],
  );

  const stats = useMemo(() => {
    const today = new Date();
    const thisMonth = enrolled.filter((l) => {
      try {
        return isSameMonth(parseISO(l.date), today);
      } catch {
        return false;
      }
    }).length;
    return {
      total: enrolled.length,
      thisMonth,
    };
  }, [enrolled]);

  const examTiles = useMemo(() => {
    return targetExamValues.map((value) => {
      const count = enrolled.filter((l) =>
        (l.targetExams ?? []).some(
          (t) =>
            typeof t === "string" &&
            t.trim().toLowerCase() === value.toLowerCase(),
        ),
      ).length;
      return {
        key: value,
        label: targetExamLabel(value),
        count,
      };
    });
  }, [enrolled, targetExamValues, targetExamLabel]);

  const statsBusy = loading || targetExamsLoading;

  const dashboardTiles = useMemo(
    () => [
      {
        key: "total",
        label: "Total enrolled",
        val: stats.total,
        accent: "text-primary" as const,
      },
      {
        key: "month",
        label: "This month",
        val: stats.thisMonth,
        accent: "text-emerald-600" as const,
      },
      ...examTiles.map((t) => ({
        key: t.key,
        label: t.label,
        val: t.count,
        accent: "text-slate-800" as const,
      })),
    ],
    [stats.total, stats.thisMonth, examTiles],
  );

  const feeByLeadId = useMemo(() => {
    const m = new Map<string, FeeRecord>();
    for (const f of fees) {
      if (f.leadId) m.set(f.leadId, f);
    }
    return m;
  }, [fees]);

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Enrolled students</h1>
            <p className={SX.toolbarMeta}>
              Leads on the Converted tab, with fee status from fee records when
              linked
            </p>
          </div>
        </div>

        {error ? (
          <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {error}{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => void load({ force: true, showLoading: true })}
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className={SX.leadStatBar}>
          <span className="text-slate-600">
            <strong className="font-semibold text-slate-800">
              {statsBusy ? "…" : stats.total}
            </strong>{" "}
            enrolled in view
          </span>
        </div>

        <div className="space-y-2 border-b border-slate-200/90 bg-white px-3 py-4 lg:px-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {dashboardTiles.map((tile) => (
              <div
                key={tile.key}
                className="rounded-none border border-slate-200/90 bg-slate-50/50 px-3 py-3 text-center shadow-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {tile.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-xl font-bold tabular-nums",
                    tile.accent,
                  )}
                >
                  {statsBusy ? "…" : tile.val}
                </p>
              </div>
            ))}
          </div>
          {!targetExamsLoading && targetExamValues.length === 0 ? (
            <p className="text-[12px] text-slate-500">
              Add target courses under{" "}
              <Link
                href="/exams-subjects"
                className="font-medium text-primary underline"
              >
                Exams &amp; subjects
              </Link>{" "}
              to see per-exam counts here.
            </p>
          ) : null}
        </div>

        <div className="border-b border-slate-200/90 bg-white px-3 py-3 sm:px-4">
          <h2 className="text-[13px] font-bold text-slate-800">All enrolled</h2>
          <p className="text-[12px] text-slate-500">
            Lead ID, target exams, grade, intake date, and fee record status
          </p>
        </div>

        <div className="overflow-x-auto bg-white p-2 sm:p-4">
          <table className={cn(SX.dataTable, "min-w-[800px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>#</th>
                <th className={SX.dataTh}>Lead ID</th>
                <th className={SX.dataTh}>Student</th>
                <th className={SX.dataTh}>Course</th>
                <th className={SX.dataTh}>Batch</th>
                <th className={SX.dataTh}>Date</th>
                <th className={SX.dataTh}>Fee</th>
                <th className={SX.dataTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className={SX.dataTd} colSpan={8}>
                    Loading…
                  </td>
                </tr>
              ) : enrolled.length === 0 ? (
                <tr>
                  <td className={SX.dataTd} colSpan={8}>
                    No converted leads yet. Move a lead to the Converted tab on
                    the main sheet to see them here.
                  </td>
                </tr>
              ) : (
                enrolled.map((r, i) => {
                  const fee = feeByLeadId.get(r.id);
                  const feeLabel = fee?.status ?? "—";
                  const isPaid = feeLabel === "Paid";
                  return (
                    <tr key={r.id}>
                      <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                        {i + 1}
                      </td>
                      <td
                        className={cn(
                          SX.dataTd,
                          i % 2 === 1 && SX.zebraRow,
                          "font-mono text-[12px]",
                        )}
                      >
                        {r.id}
                      </td>
                      <td
                        className={cn(
                          SX.dataTd,
                          i % 2 === 1 && SX.zebraRow,
                          "font-medium",
                        )}
                      >
                        {r.studentName}
                      </td>
                      <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                        <span className="rounded-none bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-primary">
                          {formatTargetExams(r.targetExams)}
                        </span>
                      </td>
                      <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                        {r.grade || "—"}
                      </td>
                      <td
                        className={cn(
                          SX.dataTd,
                          i % 2 === 1 && SX.zebraRow,
                          "tabular-nums",
                        )}
                      >
                        {safeFormatLeadDate(r.date)}
                      </td>
                      <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                        <span
                          className={cn(
                            "rounded-none px-2 py-0.5 text-[11px] font-semibold",
                            feeLabel === "—"
                              ? "bg-slate-100 text-slate-600"
                              : isPaid
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-amber-50 text-amber-900",
                          )}
                        >
                          {feeLabel}
                        </span>
                      </td>
                      <td
                        className={cn(
                          SX.dataTd,
                          i % 2 === 1 && SX.zebraRow,
                          "text-primary",
                        )}
                      >
                        <Link
                          href={`/students/${encodeURIComponent(r.id)}`}
                          className="font-medium hover:underline"
                        >
                          Open student
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
