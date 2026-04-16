"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import type { FeeRecord } from "@/lib/types";
import type { CurrencyFxPublic } from "@/lib/currencyApiFx";
import {
  DEFAULT_INSTITUTE,
  type InstituteRecord,
} from "@/lib/instituteProfileTypes";

type FeeRow = {
  id: string;
  student: string;
  course: string;
  total: number;
  discount: number;
  final: number;
  paid: number;
  emi: number;
  status: FeeRecord["status"];
};

type ExamCourseFeeRow = {
  exam: string;
  courseId: string;
  courseName: string;
  baseFee: number;
  notes: string;
  updatedAt?: string | null;
};

export default function FeeManagementPage() {
  const {
    activeValues: targetCourseOptions,
    labelFor: targetCourseLabel,
    loading: targetExamsLoading,
  } = useTargetExamOptions();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const [examRows, setExamRows] = useState<ExamCourseFeeRow[]>([]);
  const [examLoading, setExamLoading] = useState(true);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examSavedAt, setExamSavedAt] = useState<string | null>(null);

  const [taxInstitute, setTaxInstitute] =
    useState<InstituteRecord>(DEFAULT_INSTITUTE);
  const [taxLoading, setTaxLoading] = useState(true);
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxError, setTaxError] = useState<string | null>(null);
  const [taxSavedAt, setTaxSavedAt] = useState<string | null>(null);
  const [currencyFx, setCurrencyFx] = useState<CurrencyFxPublic | null>(null);
  const [cronSecretInput, setCronSecretInput] = useState("");
  const [fxSyncing, setFxSyncing] = useState(false);
  const [fxSyncMsg, setFxSyncMsg] = useState<string | null>(null);

  const loadTaxSettings = useCallback(async () => {
    setTaxLoading(true);
    setTaxError(null);
    try {
      const res = await fetch("/api/settings/institute-profile", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        institute?: InstituteRecord;
        error?: string;
        currencyFx?: CurrencyFxPublic | null;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Load failed.",
        );
      }
      const inst = data.institute;
      setTaxInstitute(
        inst && typeof inst === "object"
          ? { ...DEFAULT_INSTITUTE, ...inst }
          : DEFAULT_INSTITUTE,
      );
      const cf = data.currencyFx;
      setCurrencyFx(
        cf && typeof cf === "object"
          ? {
              istDate:
                typeof cf.istDate === "string" ? cf.istDate : null,
              fetchedAt:
                typeof cf.fetchedAt === "string" ? cf.fetchedAt : null,
              inrPerUsd:
                typeof cf.inrPerUsd === "number" ? cf.inrPerUsd : null,
              inrPerAed:
                typeof cf.inrPerAed === "number" ? cf.inrPerAed : null,
            }
          : null,
      );
    } catch (e) {
      setTaxError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setTaxLoading(false);
    }
  }, []);

  const saveTaxSettings = useCallback(async () => {
    setTaxSaving(true);
    setTaxError(null);
    setTaxSavedAt(null);
    try {
      const res = await fetch("/api/settings/institute-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institute: taxInstitute }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        institute?: InstituteRecord;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Save failed.",
        );
      }
      const inst = data.institute;
      if (inst && typeof inst === "object") {
        setTaxInstitute({ ...DEFAULT_INSTITUTE, ...inst });
      }
      setTaxSavedAt(new Date().toISOString());
    } catch (e) {
      setTaxError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setTaxSaving(false);
    }
  }, [taxInstitute]);

  const runManualFxSync = useCallback(
    async (force: boolean) => {
      setFxSyncing(true);
      setFxSyncMsg(null);
      setTaxError(null);
      try {
        const query = force ? "?force=1" : "";
        const res = await fetch(`/api/cron/currency-fx${query}`, {
          method: "POST",
          headers: cronSecretInput.trim()
            ? { "x-cron-secret": cronSecretInput.trim() }
            : {},
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          skipped?: boolean;
          istDate?: string;
          inrPerUsd?: number;
          inrPerAed?: number;
          fetchedAt?: string;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "FX sync failed.",
          );
        }

        if (
          typeof data.inrPerUsd === "number" &&
          Number.isFinite(data.inrPerUsd) &&
          typeof data.inrPerAed === "number" &&
          Number.isFinite(data.inrPerAed)
        ) {
          setTaxInstitute((s) => ({
            ...s,
            inrPerUsd: data.inrPerUsd as number,
            inrPerAed: data.inrPerAed as number,
          }));
        }

        const fetchedAt =
          typeof data.fetchedAt === "string" ? data.fetchedAt : null;
        const istDate = typeof data.istDate === "string" ? data.istDate : null;
        setCurrencyFx((prev) => ({
          istDate: istDate ?? prev?.istDate ?? null,
          fetchedAt: fetchedAt ?? prev?.fetchedAt ?? null,
          inrPerUsd:
            typeof data.inrPerUsd === "number"
              ? data.inrPerUsd
              : prev?.inrPerUsd ?? null,
          inrPerAed:
            typeof data.inrPerAed === "number"
              ? data.inrPerAed
              : prev?.inrPerAed ?? null,
        }));

        setFxSyncMsg(
          data.skipped
            ? "Already synced for current IST day. Use Force sync only if needed."
            : "Currency rates updated from CurrencyAPI.",
        );
      } catch (e) {
        setTaxError(e instanceof Error ? e.message : "FX sync failed.");
      } finally {
        setFxSyncing(false);
      }
    },
    [cronSecretInput],
  );

  useEffect(() => {
    void loadTaxSettings();
  }, [loadTaxSettings]);

  const loadExamStructures = useCallback(async () => {
    setExamLoading(true);
    setExamError(null);
    try {
      const res = await fetch("/api/exam-fee-structures", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load exam fee defaults.");
      const data = (await res.json()) as ExamCourseFeeRow[];
      if (Array.isArray(data)) {
        setExamRows(
          data.map((d) => ({
            exam: typeof d.exam === "string" ? d.exam : "",
            courseId: typeof d.courseId === "string" ? d.courseId : "",
            courseName: typeof d.courseName === "string" ? d.courseName : "",
            baseFee:
              typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
                ? d.baseFee
                : 0,
            notes: typeof d.notes === "string" ? d.notes : "",
            updatedAt: d.updatedAt ?? null,
          })),
        );
      }
    } catch (e) {
      setExamError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setExamLoading(false);
    }
  }, []);

  const saveExamStructures = useCallback(async () => {
    setExamSaving(true);
    setExamError(null);
    setExamSavedAt(null);
    try {
      const res = await fetch("/api/exam-fee-structures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: examRows
            .filter((r) => r.courseId)
            .map((r) => ({
              exam: r.exam,
              courseId: r.courseId,
              baseFee: r.baseFee,
              notes: r.notes,
            })),
        }),
      });
      if (!res.ok) throw new Error("Save failed.");
      const data = (await res.json()) as ExamCourseFeeRow[];
      if (Array.isArray(data)) {
        setExamRows(
          data.map((d) => ({
            exam: typeof d.exam === "string" ? d.exam : "",
            courseId: typeof d.courseId === "string" ? d.courseId : "",
            courseName: typeof d.courseName === "string" ? d.courseName : "",
            baseFee:
              typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
                ? d.baseFee
                : 0,
            notes: typeof d.notes === "string" ? d.notes : "",
            updatedAt: d.updatedAt ?? null,
          })),
        );
      }
      setExamSavedAt(new Date().toISOString());
    } catch (e) {
      setExamError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setExamSaving(false);
    }
  }, [examRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feesRes, leadsRes] = await Promise.all([
        fetch("/api/fees", { cache: "no-store" }),
        fetch("/api/leads", { cache: "no-store" }),
      ]);
      if (!feesRes.ok) throw new Error("fees");
      const fees = (await feesRes.json()) as FeeRecord[];
      setRows(
        fees.map((f) => ({
          id: f.id,
          student: f.studentName,
          course: f.course,
          total: f.total,
          discount: f.discount,
          final: f.final,
          paid: f.paid,
          emi: f.emi,
          status: f.status,
        })),
      );
      if (leadsRes.ok) {
        const leads = (await leadsRes.json()) as unknown[];
        setLeadCount(leads.length);
      }
    } catch {
      setError("Could not load fee data. Check MongoDB and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadExamStructures();
  }, [loadExamStructures]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterCourse && r.course !== filterCourse) return false;
      return true;
    });
  }, [rows, filterStatus, filterCourse]);

  const totals = useMemo(() => {
    const totalRev = rows.reduce((s, r) => s + r.total, 0);
    const collected = rows.reduce((s, r) => s + r.paid, 0);
    const pending = rows.reduce((s, r) => s + (r.final - r.paid), 0);
    return {
      totalRev,
      collected,
      pending,
      month: collected,
    };
  }, [rows]);

  const badge = (s: string) => {
    const map: Record<string, string> = {
      Paid: "bg-[#e8f5e9] text-[#2e7d32]",
      Partial: "bg-[#fffde7] text-[#f57f17]",
      Pending: "bg-[#e3f2fd] text-[#1565c0]",
      Overdue: "bg-[#ffebee] text-[#c62828]",
    };
    return map[s] ?? "bg-[#f5f5f5] text-[#757575]";
  };

  const updateExamBaseFee = (key: string, baseFee: number) => {
    setExamRows((prev) =>
      prev.map((r) =>
        `${r.exam}::${r.courseId}` === key ? { ...r, baseFee } : r,
      ),
    );
  };

  const updateExamNotes = (key: string, notes: string) => {
    setExamRows((prev) =>
      prev.map((r) =>
        `${r.exam}::${r.courseId}` === key ? { ...r, notes } : r,
      ),
    );
  };

  const rowKey = (r: ExamCourseFeeRow) => `${r.exam}::${r.courseId}`;

  return (
    <div className={SX.pageWrap}>
      <div className={cn(SX.outerSheet, "mb-6")}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h2 className={SX.toolbarTitle}>GST &amp; FX (fee preview)</h2>
            <p className={SX.toolbarMeta}>
              Used on student Step 3 · Fees to compute NRO GST and USD/AED display.
              Same fields as{" "}
              <Link
                href="/bank-details"
                className="font-medium text-primary underline"
              >
                Bank &amp; institute
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <input
              type="password"
              className={cn(SX.input, "h-9 w-[220px]")}
              placeholder="CRON_SECRET for manual sync"
              value={cronSecretInput}
              onChange={(e) => setCronSecretInput(e.target.value)}
            />
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={fxSyncing || taxLoading}
              onClick={() => void runManualFxSync(false)}
              title="Runs daily sync (respects one-call-per-IST-day rule)"
            >
              {fxSyncing ? "Syncing…" : "Sync FX now"}
            </button>
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={fxSyncing || taxLoading}
              onClick={() => void runManualFxSync(true)}
              title="For testing: bypasses daily skip and fetches again"
            >
              Force sync
            </button>
            <button
              type="button"
              className={SX.leadBtnGreen}
              disabled={taxSaving || taxLoading}
              onClick={() => void saveTaxSettings()}
            >
              {taxSaving ? "Saving…" : "Save tax & FX"}
            </button>
          </div>
        </div>
        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            taxError && "bg-rose-50/80 text-rose-900",
            !taxError &&
              (taxSavedAt || fxSyncMsg) &&
              "bg-emerald-50/50 text-emerald-900",
          )}
        >
          <span className="text-[13px]" role={taxError ? "alert" : undefined}>
            {taxError ? (
              taxError
            ) : fxSyncMsg ? (
              fxSyncMsg
            ) : taxSavedAt ? (
              `Saved (${new Date(taxSavedAt).toLocaleString()}).`
            ) : taxLoading ? (
              "Loading…"
            ) : (
              "Adjust GST % and reference FX rates for fee previews."
            )}
          </span>
        </div>
        {!taxLoading ? (
          <div className="grid gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:grid-cols-3">
            <label className="block text-[12px] font-medium text-slate-700">
              GST % (NRO)
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                className={cn(SX.input, "mt-1 tabular-nums")}
                value={taxInstitute.feeGstPercent}
                onChange={(e) =>
                  setTaxInstitute((s) => ({
                    ...s,
                    feeGstPercent: Math.min(
                      100,
                      Math.max(0, Number(e.target.value) || 0),
                    ),
                  }))
                }
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-700">
              INR per 1 USD
              <input
                type="number"
                min={0.0001}
                step={0.01}
                className={cn(SX.input, "mt-1 tabular-nums")}
                value={taxInstitute.inrPerUsd}
                onChange={(e) =>
                  setTaxInstitute((s) => ({
                    ...s,
                    inrPerUsd: Math.max(0.0001, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label className="block text-[12px] font-medium text-slate-700">
              INR per 1 AED
              <input
                type="number"
                min={0.0001}
                step={0.01}
                className={cn(SX.input, "mt-1 tabular-nums")}
                value={taxInstitute.inrPerAed}
                onChange={(e) =>
                  setTaxInstitute((s) => ({
                    ...s,
                    inrPerAed: Math.max(0.0001, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
          </div>
        ) : (
          <p className="px-4 py-3 text-sm text-slate-600">Loading…</p>
        )}
        {!taxLoading ? (
          <p className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-[11px] leading-snug text-slate-600">
            INR/USD and INR/AED shown above are written by the daily CurrencyAPI job
            (one request per IST day, ~6:00 AM IST). Saving this form overrides them until
            the next sync.
            {currencyFx?.fetchedAt
              ? ` Last automatic sync: ${new Date(currencyFx.fetchedAt).toLocaleString()}.`
              : null}
          </p>
        ) : null}
      </div>

      <div className={SX.outerSheet} id="exam-fee-defaults">
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h2 className={SX.toolbarTitle}>Default fees by exam &amp; course</h2>
            <p className={SX.toolbarMeta}>
              Courses come from{" "}
              <Link
                href="/exam-courses"
                className="font-medium text-primary underline"
              >
                Exam courses
              </Link>
              . Values here auto-fill the fee step on student workspaces when the
              same exam and course apply.
            </p>
          </div>
          <button
            type="button"
            className={SX.leadBtnGreen}
            disabled={examSaving || examLoading || targetExamsLoading}
            onClick={() => void saveExamStructures()}
          >
            {examSaving ? "Saving…" : "Save defaults"}
          </button>
        </div>

        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            examError && "bg-rose-50/80 text-rose-900",
            !examError && examSavedAt && "bg-emerald-50/50 text-emerald-900",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 text-[13px]",
              !examError && !examSavedAt && "font-normal text-slate-600",
            )}
            role={examError ? "alert" : examSavedAt ? "status" : undefined}
          >
            {examError ? (
              examError
            ) : examSavedAt ? (
              `Saved (${new Date(examSavedAt).toLocaleString()}).`
            ) : examLoading || targetExamsLoading ? (
              "Loading defaults…"
            ) : (
              "Edit base fee (₹) and notes per row, then save."
            )}
          </span>
        </div>

        {!examLoading && !targetExamsLoading ? (
          <div className="overflow-x-auto border-b border-slate-200 bg-white">
            <table className={cn(SX.dataTable, "min-w-[720px]")}>
              <thead>
                <tr>
                  <th className={SX.dataTh}>Exam</th>
                  <th className={SX.dataTh}>Course</th>
                  <th className={cn(SX.dataTh, "tabular-nums")}>Base fee (₹)</th>
                  <th className={SX.dataTh}>Notes</th>
                  <th className={SX.dataTh}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {examRows.length === 0 ? (
                  <tr>
                    <td className={SX.dataTd} colSpan={5}>
                      No rows. Add target exams and courses under{" "}
                      <Link
                        href="/exam-courses"
                        className="font-medium text-primary underline"
                      >
                        Exam courses
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  examRows.map((r, i) => {
                    const k = rowKey(r);
                    const disabledRow = !r.courseId;
                    return (
                      <tr
                        key={k}
                        className={i % 2 === 1 ? SX.zebraRow : undefined}
                      >
                        <td className={cn(SX.dataTd, "font-medium text-slate-900")}>
                          {targetCourseLabel(r.exam)}
                        </td>
                        <td className={SX.dataTd}>
                          {disabledRow ? (
                            <span className="text-slate-500">{r.courseName}</span>
                          ) : (
                            r.courseName
                          )}
                        </td>
                        <td className={SX.dataTd}>
                          <input
                            type="number"
                            min={0}
                            disabled={disabledRow}
                            className={cn(
                              SX.input,
                              "max-w-[140px] tabular-nums",
                              disabledRow && "cursor-not-allowed opacity-50",
                            )}
                            value={r.baseFee}
                            onChange={(e) =>
                              updateExamBaseFee(
                                k,
                                Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0),
                                ),
                              )
                            }
                            aria-label={`Base fee for ${targetCourseLabel(r.exam)} — ${r.courseName}`}
                          />
                        </td>
                        <td className={SX.dataTd}>
                          <input
                            type="text"
                            disabled={disabledRow}
                            className={cn(
                              SX.input,
                              "min-w-[140px] max-w-md",
                              disabledRow && "cursor-not-allowed opacity-50",
                            )}
                            placeholder="Optional"
                            value={r.notes}
                            onChange={(e) => updateExamNotes(k, e.target.value)}
                          />
                        </td>
                        <td
                          className={cn(SX.dataTd, "text-[11px] text-slate-500")}
                        >
                          {r.updatedAt
                            ? new Date(r.updatedAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-slate-600">Loading defaults…</p>
        )}
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={cn(SX.toolbarTitle, "text-lg")}>Student fee records</h1>
          <button
            type="button"
            className={SX.btnSecondary}
            onClick={() => {
              document
                .getElementById("exam-fee-defaults")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Exam &amp; course defaults
          </button>
        </div>

        {error && (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="text-sm text-slate-600">Loading fees…</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "Total Revenue",
              `₹${totals.totalRev.toLocaleString("en-IN")}`,
              "text-[#1565c0]",
            ],
            [
              "Collected",
              `₹${totals.collected.toLocaleString("en-IN")}`,
              "text-[#2e7d32]",
            ],
            [
              "Pending",
              `₹${totals.pending.toLocaleString("en-IN")}`,
              "text-[#f57f17]",
            ],
            [
              "This Month",
              `₹${totals.month.toLocaleString("en-IN")}`,
              "text-[#212121]",
            ],
          ].map(([label, val, c]) => (
            <div
              key={label}
              className="rounded-none border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className={cn("mt-1 text-lg font-bold", c)}>{val}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className={SX.select}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
          <select
            className={SX.select}
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
          >
            <option value="">All courses</option>
            {targetCourseOptions.map((c) => (
              <option key={c} value={c}>
                {targetCourseLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-auto rounded-none border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Target exam</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Discount</th>
                <th className="px-2 py-2">Final</th>
                <th className="px-2 py-2">Paid</th>
                <th className="px-2 py-2">Balance</th>
                <th className="px-2 py-2">EMI</th>
                <th className="px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="min-h-[40px] hover:bg-slate-50/80">
                  <td className="border-b border-slate-100 px-2 py-2">{i + 1}</td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    {r.student}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    {targetCourseLabel(r.course) || r.course || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    ₹{r.total.toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    <input
                      type="number"
                      className="w-14 rounded-none border border-slate-200 px-1"
                      defaultValue={r.discount}
                    />
                    %
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    ₹{r.final.toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    ₹{r.paid.toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    ₹{(r.final - r.paid).toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    {r.emi ? `${r.emi} mo` : "—"}
                  </td>
                  <td className="border-b border-slate-100 px-2 py-2">
                    <span
                      className={`rounded-none px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          Fee records from database: {rows.length} row{rows.length === 1 ? "" : "s"}.
          {leadCount != null ? ` Leads in system: ${leadCount}.` : ""}
        </p>
      </div>
    </div>
  );
}
