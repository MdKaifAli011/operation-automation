"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InstituteBankDetailsPanel } from "@/components/student/fee/InstituteBankDetailsPanel";
import { PipelineStepFrame } from "./PipelineStepFrame";
import type { FeesStepPanelProps } from "./pipelineStepTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  applyGstToLine,
  buildFeePreviewLines,
  defaultFeeLineDescription,
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

const DURATIONS = ["6 Months", "1 Year", "2 Year", "Dropper"] as const;
const CURRENCIES = ["INR", "USD", "AED", "EUR"] as const;

function newInstallmentRow(): LeadPipelineFeeInstallmentRow {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `inst-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: "",
    amountInr: 0,
    dueDate: "",
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
  const [courseDuration, setCourseDuration] = useState("1 Year");
  const [customCourseName, setCustomCourseName] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [scholarshipPct, setScholarshipPct] = useState(0);
  const [baseTotal, setBaseTotal] = useState(0);
  const [feeMasterDueDate, setFeeMasterDueDate] = useState("");
  const [installmentRows, setInstallmentRows] = useState<
    LeadPipelineFeeInstallmentRow[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fx: InstituteFeeFx = useMemo(
    () => ({
      feeGstPercent: institute.feeGstPercent,
      inrPerUsd: institute.inrPerUsd,
      inrPerAed: institute.inrPerAed,
    }),
    [institute],
  );

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
    setCourseDuration(
      typeof f.courseDuration === "string" && f.courseDuration
        ? f.courseDuration
        : "1 Year",
    );
    setCustomCourseName(
      typeof f.customCourseName === "string" ? f.customCourseName : "",
    );
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
    setFeeMasterDueDate(
      typeof f.feeMasterDueDate === "string"
        ? f.feeMasterDueDate
        : typeof legacyDates[0] === "string"
          ? legacyDates[0]
          : "",
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
            dueDate: String(r.dueDate ?? ""),
          };
        }),
      );
    } else {
      setInstallmentRows([]);
    }
  }, [lead.id, feesKey]);

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

  const installmentSum = useMemo(
    () =>
      installmentRows.reduce(
        (acc, r) => acc + Math.max(0, Math.round(Number(r.amountInr) || 0)),
        0,
      ),
    [installmentRows],
  );

  const effectiveFinalFee =
    installmentRows.length > 0 ? installmentSum : finalFromBase;

  const sumMismatch =
    installmentRows.length > 0 &&
    installmentSum > 0 &&
    installmentSum !== finalFromBase;

  const previewLines = useMemo(
    () =>
      buildFeePreviewLines({
        installmentRows,
        finalFeeInr: finalFromBase,
        feeMasterDueDate,
        customCourseName,
      }),
    [installmentRows, finalFromBase, feeMasterDueDate, customCourseName],
  );

  const option1Lines = previewLines.map((L) => ({ ...L }));
  const option2Lines = previewLines.map((L) => ({ ...L }));
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

  const saveFeePlan = async () => {
    setSaving(true);
    try {
      const feesPatch = {
        ...((lead.pipelineMeta?.fees ?? {}) as object),
        targetExamValue,
        catalogCourseId,
        courseDuration,
        customCourseName: customCourseName.trim(),
        currency,
        scholarshipPct,
        baseTotal: Math.max(0, Math.round(baseTotal)),
        finalFee: effectiveFinalFee,
        feeMasterDueDate: feeMasterDueDate.trim() || null,
        installmentRows:
          installmentRows.length > 0
            ? installmentRows.map((r) => ({
                ...r,
                amountInr: Math.max(0, Math.round(Number(r.amountInr) || 0)),
              }))
            : [],
        installmentEnabled: installmentRows.length > 1,
        installmentCount: Math.max(installmentRows.length, 1),
        installmentAmounts: installmentRows.map((r) =>
          Math.max(0, Math.round(Number(r.amountInr) || 0)),
        ),
        installmentDates: installmentRows.map((r) => r.dueDate),
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

  const addInstallment = () => {
    setInstallmentRows((prev) => [...prev, newInstallmentRow()]);
  };

  const removeInstallment = (id: string) => {
    setInstallmentRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateRow = (
    id: string,
    patch: Partial<LeadPipelineFeeInstallmentRow>,
  ) => {
    setInstallmentRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
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
    <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
        <h4 className="text-[13px] font-semibold text-slate-900">{title}</h4>
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
        <span className="font-medium text-slate-700">INR reference: </span>
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

  return (
    <PipelineStepFrame stepNumber={3} leadId={lead.id}>
      <div className="space-y-4 px-2 py-3 sm:px-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">
              Fee structure &amp; installments
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-600">
              Configure course fee in INR. Previews use GST % and FX from{" "}
              <Link
                href="/fee-management"
                className="font-medium text-primary underline"
              >
                Fee management
              </Link>{" "}
              /{" "}
              <Link
                href="/bank-details"
                className="font-medium text-primary underline"
              >
                Bank &amp; institute
              </Link>
              .
            </p>
          </div>
          {instLoading ? (
            <span className="text-[11px] text-slate-500">Loading settings…</span>
          ) : (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
              GST {fx.feeGstPercent}% · 1 USD = ₹{fx.inrPerUsd.toFixed(2)} · 1
              AED = ₹{fx.inrPerAed.toFixed(2)}
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
          <label className="block text-[12px] font-medium text-slate-700">
            Course duration
            <select
              className={cn(SX.select, "mt-1 w-full")}
              value={courseDuration}
              onChange={(e) => setCourseDuration(e.target.value)}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-slate-700">
            Course currency (label)
            <select
              className={cn(SX.select, "mt-1 w-full")}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
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
            Total course fee (INR) — before scholarship
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
          <label className="block text-[12px] font-medium text-slate-700">
            Fee due date (single payment)
            <input
              type="date"
              className={cn(SX.input, "mt-1 tabular-nums")}
              value={feeMasterDueDate}
              onChange={(e) => setFeeMasterDueDate(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="block text-[12px] font-medium text-slate-700">
              Custom course name (optional)
              <input
                className={cn(SX.input, "mt-1")}
                value={customCourseName}
                onChange={(e) => setCustomCourseName(e.target.value)}
                placeholder="e.g. NEET Weekend Batch"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[13px]">
            <span className="text-slate-600">Net after scholarship: </span>
            <span className="font-semibold text-slate-900">
              {formatInr(finalFromBase)}
            </span>
            {installmentRows.length > 0 ? (
              <>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-600">Installments sum: </span>
                <span
                  className={cn(
                    "font-semibold",
                    sumMismatch ? "text-amber-800" : "text-slate-900",
                  )}
                >
                  {formatInr(installmentSum)}
                </span>
                {sumMismatch ? (
                  <span className="ml-2 text-[11px] text-amber-800">
                    Should match net fee ({formatInr(finalFromBase)})
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={SX.btnSecondary}
              onClick={addInstallment}
            >
              + Add installment
            </button>
            <button
              type="button"
              className={SX.btnSecondary}
              onClick={() => {
                setInstallmentRows([
                  {
                    ...newInstallmentRow(),
                    description: defaultFeeLineDescription(
                      1,
                      customCourseName,
                    ),
                    amountInr: finalFromBase,
                    dueDate: feeMasterDueDate,
                  },
                ]);
              }}
            >
              Use net fee as 1 installment
            </button>
          </div>
        </div>

        {installmentRows.length > 0 ? (
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
                {installmentRows.map((r, i) => (
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
                          customCourseName,
                        )}
                      />
                    </td>
                    <td className={SX.dataTd}>
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
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        type="date"
                        className={cn(SX.input, "tabular-nums")}
                        value={r.dueDate}
                        onChange={(e) =>
                          updateRow(r.id, { dueDate: e.target.value })
                        }
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
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
          <h4 className="text-[13px] font-semibold text-slate-900">
            Preview (for parents)
          </h4>
          <p className="mt-1 text-[11px] text-slate-600">
            Option 1 &amp; 2: no GST. Option 3: GST @ {fx.feeGstPercent}% on each
            line (NRO). USD/AED use institute FX; student row shows approximate
            amount in their country currency.
          </p>
          <div className="mt-3 space-y-4">
            {renderPreviewTable(
              "Option 1 — Pay in USD (no GST)",
              option1Lines,
              false,
            )}
            {renderPreviewTable(
              "Option 2 — Indian NRE account (no GST)",
              option2Lines,
              false,
            )}
            {renderPreviewTable(
              "Option 3 — Indian NRO account (GST applicable)",
              option3Lines,
              true,
            )}
          </div>
        </section>

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
            disabled={saving}
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
