"use client";

import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InstituteBankDetailsPanel } from "@/components/student/fee/InstituteBankDetailsPanel";
import { PipelineStepFrame } from "./PipelineStepFrame";
import type { FeesStepPanelProps } from "./pipelineStepTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  applyGstToLine,
  balanceInstallmentAmounts,
  buildFeePreviewLines,
  defaultFeeLineDescription,
  equalSplitInr,
  formatInr,
  formatStudentCountryFromInr,
  formatUsd,
  inrToUsd,
  type InstituteFeeFx,
} from "@/lib/feeStepComputations";
import type { LeadPipelineFeeInstallmentRow } from "@/lib/leadPipelineMetaTypes";
import { DEFAULT_INSTITUTE, type InstituteRecord } from "@/lib/instituteProfileTypes";
import { appendActivity, mergePipelineMeta } from "@/lib/pipeline";
import { useExamCourseCatalog } from "@/hooks/useExamCourseCatalog";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";

const CURRENCIES = ["INR", "USD", "AED", "EUR"] as const;

function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultSecondDueIso(): string {
  return format(addDays(new Date(), 30), "yyyy-MM-dd");
}

function newInstallmentRow(): LeadPipelineFeeInstallmentRow {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `inst-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: "",
    amountInr: 0,
    dueDate: todayIsoLocal(),
  };
}

export function FeesStepPanel({
  lead,
  onPatchLead,
  refreshLead,
}: FeesStepPanelProps) {
  const { labelFor: examLabel, activeValues: examValues } =
    useTargetExamOptions();
  const { byExam: coursesByExam, loading: coursesLoading } =
    useExamCourseCatalog();

  const [institute, setInstitute] = useState<InstituteRecord>(DEFAULT_INSTITUTE);
  const [instLoading, setInstLoading] = useState(true);

  const feesMeta = (lead.pipelineMeta?.fees ?? {}) as Record<string, unknown>;
  const feesKey = JSON.stringify(lead.pipelineMeta?.fees ?? {});
  const [targetExamValue, setTargetExamValue] = useState("");
  const [catalogCourseId, setCatalogCourseId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [scholarshipPct, setScholarshipPct] = useState(0);
  const [baseTotal, setBaseTotal] = useState(0);
  const [feeMasterDueDate, setFeeMasterDueDate] = useState("");
  const [installmentRows, setInstallmentRows] = useState<
    LeadPipelineFeeInstallmentRow[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const minDue = todayIsoLocal();

  const fx: InstituteFeeFx = useMemo(
    () => ({
      feeGstPercent: institute.feeGstPercent,
      inrPerUsd: institute.inrPerUsd,
      inrPerAed: institute.inrPerAed,
    }),
    [institute],
  );

  const selectedCourseName = useMemo(() => {
    const list = coursesByExam.get(targetExamValue) ?? [];
    return list.find((c) => c.id === catalogCourseId)?.name?.trim() ?? "";
  }, [coursesByExam, targetExamValue, catalogCourseId]);

  const loadInstitute = useCallback(async () => {
    setInstLoading(true);
    try {
      const res = await fetch("/api/settings/institute-profile", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        institute?: InstituteRecord;
      };
      const inst = data.institute;
      setInstitute(
        inst && typeof inst === "object"
          ? { ...DEFAULT_INSTITUTE, ...inst }
          : DEFAULT_INSTITUTE,
      );
    } finally {
      setInstLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInstitute();
  }, [loadInstitute]);

  useEffect(() => {
    const f = (lead.pipelineMeta?.fees ?? {}) as Record<string, unknown>;
    const te =
      typeof f.targetExamValue === "string" ? f.targetExamValue.trim() : "";
    const cc =
      typeof f.catalogCourseId === "string" ? f.catalogCourseId.trim() : "";
    setTargetExamValue(te);
    setCatalogCourseId(cc);
    setCurrency(
      typeof f.currency === "string" && f.currency ? f.currency : "INR",
    );
    setScholarshipPct(
      typeof f.scholarshipPct === "number" && Number.isFinite(f.scholarshipPct)
        ? Math.min(100, Math.max(0, f.scholarshipPct))
        : 0,
    );
    setBaseTotal(
      typeof f.baseTotal === "number" && Number.isFinite(f.baseTotal)
        ? Math.max(0, Math.round(f.baseTotal))
        : typeof f.finalFee === "number" && Number.isFinite(f.finalFee)
          ? Math.max(0, Math.round(f.finalFee))
          : 0,
    );
    const legacyDates = Array.isArray(f.installmentDates)
      ? (f.installmentDates as string[])
      : [];
    const rawMaster =
      typeof f.feeMasterDueDate === "string"
        ? f.feeMasterDueDate
        : typeof legacyDates[0] === "string"
          ? legacyDates[0]
          : minDue;
    setFeeMasterDueDate(
      rawMaster && rawMaster < minDue ? minDue : rawMaster || minDue,
    );
    const ir = f.installmentRows;
    if (Array.isArray(ir) && ir.length > 0) {
      setInstallmentRows(
        ir.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id ?? "").trim() || newInstallmentRow().id,
            description: String(r.description ?? ""),
            amountInr:
              typeof r.amountInr === "number" && Number.isFinite(r.amountInr)
                ? Math.round(r.amountInr)
                : 0,
            dueDate: (() => {
              const d = String(r.dueDate ?? "").trim() || minDue;
              return d < minDue ? minDue : d;
            })(),
          };
        }),
      );
    } else {
      setInstallmentRows([]);
    }
  }, [lead.id, feesKey, minDue]);

  useEffect(() => {
    if (!targetExamValue && lead.targetExams?.length) {
      setTargetExamValue(String(lead.targetExams[0]).trim());
    }
  }, [lead.targetExams, targetExamValue]);

  const examChoices = useMemo(() => {
    const s = new Set<string>();
    for (const v of examValues) s.add(v);
    for (const x of lead.targetExams ?? []) {
      const t = String(x ?? "").trim();
      if (t) s.add(t);
    }
    return [...s];
  }, [examValues, lead.targetExams]);

  const coursesForExam = useMemo(() => {
    const list = coursesByExam.get(targetExamValue) ?? [];
    return [...list].sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }, [coursesByExam, targetExamValue]);

  const finalFromBase = useMemo(() => {
    const b = Math.max(0, Math.round(baseTotal));
    const s = Math.min(100, Math.max(0, scholarshipPct));
    return Math.round(b * (1 - s / 100));
  }, [baseTotal, scholarshipPct]);

  /** When net total changes, rebalance last installment so sum stays = net. */
  useEffect(() => {
    if (installmentRows.length < 2) return;
    setInstallmentRows((prev) =>
      balanceInstallmentAmounts(prev, finalFromBase),
    );
  }, [finalFromBase, installmentRows.length]);

  const installmentSum = useMemo(
    () =>
      installmentRows.reduce(
        (acc, r) => acc + Math.max(0, Math.round(Number(r.amountInr) || 0)),
        0,
      ),
    [installmentRows],
  );

  const effectiveFinalFee =
    installmentRows.length >= 2 ? installmentSum : finalFromBase;

  const headSumExceedsNet =
    installmentRows.length >= 2 &&
    installmentRows
      .slice(0, -1)
      .reduce((a, r) => a + Math.max(0, Math.round(r.amountInr || 0)), 0) >
      finalFromBase;

  const previewLines = useMemo(
    () =>
      buildFeePreviewLines({
        installmentRows,
        finalFeeInr: finalFromBase,
        feeMasterDueDate,
        courseLabel: selectedCourseName,
      }),
    [installmentRows, finalFromBase, feeMasterDueDate, selectedCourseName],
  );

  const option3Lines = previewLines.map((L) =>
    applyGstToLine({ ...L }, fx.feeGstPercent),
  );

  const pushToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadDefaultFeeFromCatalog = useCallback(async () => {
    if (!targetExamValue || !catalogCourseId) return;
    try {
      const res = await fetch("/api/exam-fee-structures", { cache: "no-store" });
      if (!res.ok) return;
      const rows = (await res.json()) as Array<{
        exam?: string;
        courseId?: string;
        baseFee?: number;
      }>;
      const hit = rows.find(
        (r) =>
          String(r.exam ?? "").trim() === targetExamValue &&
          String(r.courseId ?? "").trim() === catalogCourseId,
      );
      if (hit && typeof hit.baseFee === "number" && hit.baseFee > 0) {
        setBaseTotal(Math.round(hit.baseFee));
      }
    } catch {
      /* ignore */
    }
  }, [targetExamValue, catalogCourseId]);

  useEffect(() => {
    void loadDefaultFeeFromCatalog();
  }, [loadDefaultFeeFromCatalog]);

  const startTwoInstallments = () => {
    const net = Math.max(0, finalFromBase);
    const parts = equalSplitInr(net, 2);
    const label = selectedCourseName;
    setInstallmentRows([
      {
        ...newInstallmentRow(),
        amountInr: parts[0] ?? 0,
        dueDate: minDue,
        description: defaultFeeLineDescription(1, label),
      },
      {
        ...newInstallmentRow(),
        amountInr: parts[1] ?? 0,
        dueDate: defaultSecondDueIso(),
        description: defaultFeeLineDescription(2, label),
      },
    ]);
  };

  const addInstallment = () => {
    setInstallmentRows((prev) => {
      if (prev.length < 2) {
        const net = Math.max(0, finalFromBase);
        const parts = equalSplitInr(net, 2);
        const label = selectedCourseName;
        return [
          {
            ...newInstallmentRow(),
            amountInr: parts[0] ?? 0,
            dueDate: minDue,
            description: defaultFeeLineDescription(1, label),
          },
          {
            ...newInstallmentRow(),
            amountInr: parts[1] ?? 0,
            dueDate: defaultSecondDueIso(),
            description: defaultFeeLineDescription(2, label),
          },
        ];
      }
      const net = Math.max(0, finalFromBase);
      const next = [
        ...prev,
        {
          ...newInstallmentRow(),
          dueDate: minDue,
          description: defaultFeeLineDescription(prev.length + 1, selectedCourseName),
        },
      ];
      const parts = equalSplitInr(net, next.length);
      return next.map((r, i) => ({ ...r, amountInr: parts[i] ?? 0 }));
    });
  };

  const removeInstallment = (id: string) => {
    setInstallmentRows((prev) => {
      if (prev.length <= 2) {
        return [];
      }
      const next = prev.filter((r) => r.id !== id);
      const net = Math.max(0, finalFromBase);
      const parts = equalSplitInr(net, next.length);
      return next.map((r, i) => ({ ...r, amountInr: parts[i] ?? 0 }));
    });
  };

  const updateRow = (
    id: string,
    patch: Partial<LeadPipelineFeeInstallmentRow>,
  ) => {
    setInstallmentRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      if (patch.amountInr !== undefined && idx === prev.length - 1) {
        return prev;
      }
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      if (patch.amountInr !== undefined && idx < prev.length - 1) {
        return balanceInstallmentAmounts(next, finalFromBase);
      }
      return next;
    });
  };

  const backToSinglePayment = () => setInstallmentRows([]);

  const saveFeePlan = async () => {
    setSaving(true);
    try {
      const feesPatch = {
        ...((lead.pipelineMeta?.fees ?? {}) as object),
        targetExamValue,
        catalogCourseId,
        courseDuration: "",
        customCourseName: "",
        currency,
        scholarshipPct,
        baseTotal: Math.max(0, Math.round(baseTotal)),
        finalFee: effectiveFinalFee,
        feeMasterDueDate:
          installmentRows.length >= 2
            ? null
            : feeMasterDueDate.trim() || null,
        installmentRows:
          installmentRows.length >= 2
            ? balanceInstallmentAmounts(
                installmentRows.map((r) => ({ ...r })),
                finalFromBase,
              ).map((r) => ({
                ...r,
                amountInr: Math.max(0, Math.round(Number(r.amountInr) || 0)),
              }))
            : [],
        installmentEnabled: installmentRows.length >= 2,
        installmentCount: Math.max(installmentRows.length, 1),
        installmentAmounts:
          installmentRows.length >= 2
            ? balanceInstallmentAmounts(
                installmentRows,
                finalFromBase,
              ).map((r) => Math.max(0, Math.round(r.amountInr)))
            : [],
        installmentDates:
          installmentRows.length >= 2
            ? balanceInstallmentAmounts(installmentRows, finalFromBase).map(
                (r) => r.dueDate,
              )
            : [],
      };
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          fees: feesPatch,
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "fees",
          "Fee plan updated (Step 3)",
        ),
      });
      await refreshLead();
      pushToast("Fee plan saved.");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const fmtDue = (iso: string) => {
    const t = iso.trim();
    if (!t) return "—";
    try {
      return format(parseISO(t), "do MMMM yyyy");
    } catch {
      return t;
    }
  };

  const renderPreviewTable = (
    title: string,
    lines: ReturnType<typeof buildFeePreviewLines>,
    showGstColumn: boolean,
  ) => (
    <div className="mb-3 overflow-hidden rounded-lg border border-slate-200 bg-white last:mb-0">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
        <h4 className="text-[12px] font-semibold text-slate-900">{title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className={cn(SX.dataTable, "w-full min-w-[640px]")}>
          <thead>
            <tr>
              <th className={SX.dataTh}>No.</th>
              <th className={SX.dataTh}>Fee Description</th>
              <th className={SX.dataTh}>GST (Tax)</th>
              <th className={cn(SX.dataTh, "tabular-nums")}>Amount (USD)</th>
              <th className={SX.dataTh}>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row) => (
              <tr key={row.no}>
                <td className={SX.dataTd}>{row.no}</td>
                <td className={cn(SX.dataTd, "max-w-[280px]")}>
                  {row.description}
                </td>
                <td className={SX.dataTd}>
                  {showGstColumn ? (
                    <>
                      {row.gstApplicable
                        ? formatUsd(inrToUsd(row.gstAmountInr, fx.inrPerUsd))
                        : "No"}
                    </>
                  ) : (
                    "No"
                  )}
                </td>
                <td className={cn(SX.dataTd, "tabular-nums font-medium")}>
                  {formatUsd(inrToUsd(row.totalInr, fx.inrPerUsd))}
                </td>
                <td className={cn(SX.dataTd, "tabular-nums")}>
                  {fmtDue(row.dueDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600">
        <span className="font-medium text-slate-700">INR: </span>
        {lines.map((row) => (
          <span key={row.no} className="mr-3 inline-block">
            #{row.no} {formatInr(row.totalInr)}
          </span>
        ))}
        <span className="ml-1 text-slate-500">· </span>
        <span className="font-medium">Student ({lead.country || "—"}): </span>
        {lines.map((row) => (
          <span key={`s-${row.no}`} className="mr-3 inline-block">
            #{row.no}{" "}
            {formatStudentCountryFromInr(row.totalInr, lead.country ?? "", fx)}
          </span>
        ))}
      </div>
    </div>
  );

  const isInstallments = installmentRows.length >= 2;

  return (
    <PipelineStepFrame stepNumber={3} leadId={lead.id}>
      <div className="space-y-3 px-2 py-3 sm:px-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Fees</h3>
            <p className="mt-0.5 text-[12px] text-slate-600">
              GST/FX:{" "}
              <Link
                href="/fee-management"
                className="font-medium text-primary underline"
              >
                Fee management
              </Link>
              .
            </p>
          </div>
          {instLoading ? (
            <span className="text-[11px] text-slate-500">Loading…</span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
              GST {fx.feeGstPercent}% · USD ₹{fx.inrPerUsd.toFixed(2)} · AED ₹
              {fx.inrPerAed.toFixed(2)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-[12px] font-medium text-slate-700">
            Target exam
            <select
              className={cn(SX.select, "mt-1 w-full")}
              value={targetExamValue}
              onChange={(e) => {
                setTargetExamValue(e.target.value);
                setCatalogCourseId("");
              }}
            >
              <option value="">Select…</option>
              {examChoices.map((ex) => (
                <option key={ex} value={ex}>
                  {examLabel(ex)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Course (catalog)
            <select
              className={cn(SX.select, "mt-1 w-full")}
              value={catalogCourseId}
              onChange={(e) => setCatalogCourseId(e.target.value)}
              disabled={!targetExamValue || coursesLoading}
            >
              <option value="">
                {coursesLoading ? "Loading…" : "Select course…"}
              </option>
              {coursesForExam.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="block text-[12px] font-medium text-slate-700">
            <span>Display currency (student)</span>
            <p className="mb-1 mt-0.5 text-[10px] font-normal text-slate-500">
              Used for student-facing fee labels (profile / comms).
            </p>
            <select
              className={cn(SX.select, "w-full")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <label className="block text-[12px] font-medium text-slate-700">
            Scholarship %
            <input
              type="number"
              min={0}
              max={100}
              className={cn(SX.input, "mt-1 tabular-nums")}
              value={scholarshipPct}
              onChange={(e) =>
                setScholarshipPct(
                  Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                )
              }
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Total fee (INR)
            <input
              type="number"
              min={0}
              className={cn(SX.input, "mt-1 tabular-nums")}
              value={baseTotal || ""}
              onChange={(e) =>
                setBaseTotal(Math.max(0, Math.round(Number(e.target.value) || 0)))
              }
            />
          </label>
          {!isInstallments ? (
            <label className="block text-[12px] font-medium text-slate-700">
              Due date
              <input
                type="date"
                min={minDue}
                className={cn(SX.input, "mt-1 tabular-nums")}
                value={feeMasterDueDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v && v < minDue) {
                    setFeeMasterDueDate(minDue);
                    return;
                  }
                  setFeeMasterDueDate(v);
                }}
              />
            </label>
          ) : (
            <div className="text-[12px] text-slate-600">
              <span className="font-medium text-slate-700">Due dates: </span>
              per installment below (today or future).
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-[13px] text-slate-700">
            <span className="text-slate-600">Net: </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatInr(finalFromBase)}
            </span>
            {headSumExceedsNet ? (
              <span className="ml-2 text-[11px] font-medium text-rose-700">
                Earlier installments exceed net — reduce amounts.
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {!isInstallments ? (
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={finalFromBase <= 0}
                onClick={startTwoInstallments}
              >
                Split into 2 installments
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={SX.btnSecondary}
                  onClick={addInstallment}
                >
                  + Add installment
                </button>
                <button
                  type="button"
                  className={SX.btnGhost}
                  onClick={backToSinglePayment}
                >
                  Single payment
                </button>
              </>
            )}
          </div>
        </div>

        {isInstallments ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className={cn(SX.dataTable, "min-w-[720px]")}>
              <thead>
                <tr>
                  <th className={SX.dataTh}>#</th>
                  <th className={SX.dataTh}>Description</th>
                  <th className={SX.dataTh}>Amount (INR)</th>
                  <th className={SX.dataTh}>Due date</th>
                  <th className={SX.dataTh} />
                </tr>
              </thead>
              <tbody>
                {installmentRows.map((r, i) => {
                  const isLast = i === installmentRows.length - 1;
                  return (
                    <tr key={r.id}>
                      <td className={SX.dataTd}>{i + 1}</td>
                      <td className={SX.dataTd}>
                        <input
                          className={cn(SX.input, "min-w-[200px]")}
                          value={r.description}
                          onChange={(e) =>
                            updateRow(r.id, { description: e.target.value })
                          }
                          placeholder={defaultFeeLineDescription(
                            i + 1,
                            selectedCourseName,
                          )}
                        />
                      </td>
                      <td className={SX.dataTd}>
                        {isLast ? (
                          <span className="tabular-nums font-medium text-slate-800">
                            {formatInr(r.amountInr)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            className={cn(SX.input, "w-28 tabular-nums")}
                            value={r.amountInr || ""}
                            onChange={(e) =>
                              updateRow(r.id, {
                                amountInr: Math.max(
                                  0,
                                  Math.round(Number(e.target.value) || 0),
                                ),
                              })
                            }
                          />
                        )}
                      </td>
                      <td className={SX.dataTd}>
                        <input
                          type="date"
                          min={minDue}
                          className={cn(SX.input, "tabular-nums")}
                          value={r.dueDate >= minDue ? r.dueDate : minDue}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(r.id, {
                              dueDate: !v || v < minDue ? minDue : v,
                            });
                          }}
                        />
                      </td>
                      <td className={SX.dataTd}>
                        <button
                          type="button"
                          className={cn(SX.btnGhost, "text-rose-700")}
                          onClick={() => removeInstallment(r.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
              Last row auto-balances to net ({formatInr(finalFromBase)}). Edit
              amounts above it; total stays matched.
            </p>
          </div>
        ) : null}

        <details className="group rounded-lg border border-slate-200 bg-white">
          <summary
            className={cn(
              "cursor-pointer list-none px-3 py-2.5 text-[13px] font-semibold text-slate-900",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span>Preview for parents (optional)</span>
              <span
                className="inline-block text-slate-400 transition-transform group-open:rotate-90"
                aria-hidden
              >
                ▸
              </span>
            </span>
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-3">
            <p className="mb-2 text-[11px] text-slate-600">
              Options 1–2: no GST. Option 3: NRO with GST @ {fx.feeGstPercent}
              %.
            </p>
            {renderPreviewTable(
              "Option 1 — Pay in USD (no GST)",
              previewLines,
              false,
            )}
            {renderPreviewTable(
              "Option 2 — Indian NRE (no GST)",
              previewLines,
              false,
            )}
            {renderPreviewTable(
              "Option 3 — Indian NRO (GST)",
              option3Lines,
              true,
            )}
          </div>
        </details>

        <InstituteBankDetailsPanel
          leadId={lead.id}
          value={
            typeof feesMeta.feeSelectedBankAccountId === "string"
              ? feesMeta.feeSelectedBankAccountId
              : null
          }
          onChange={(id) => {
            void onPatchLead({
              pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
                fees: {
                  ...(lead.pipelineMeta?.fees as object),
                  feeSelectedBankAccountId: id,
                },
              }),
            }).then(() => refreshLead());
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={SX.btnPrimary}
            disabled={saving || headSumExceedsNet}
            onClick={() => void saveFeePlan()}
          >
            {saving ? "Saving…" : "Save fee plan"}
          </button>
        </div>

        {toast ? (
          <div className="pointer-events-none fixed right-4 top-4 z-260 w-[min(92vw,360px)] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-900 shadow-lg">
            {toast}
          </div>
        ) : null}
      </div>
    </PipelineStepFrame>
  );
}
