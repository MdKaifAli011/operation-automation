"use client";

import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InstituteBankDetailsPanel } from "@/components/student/fee/InstituteBankDetailsPanel";
import { PipelineStepFrame } from "./PipelineStepFrame";
import type { FeesStepPanelProps } from "./pipelineStepTypes";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  applyGstToLine,
  buildFeePreviewLines,
  equalSplitInr,
  formatInr,
  formatUsd,
  inrToUsd,
  redistributeAfterOneAmountEdit,
  type InstituteFeeFx,
} from "@/lib/feeStepComputations";
import type { LeadPipelineFeeInstallmentRow } from "@/lib/leadPipelineMetaTypes";
import { DEFAULT_INSTITUTE, type InstituteRecord } from "@/lib/instituteProfileTypes";
import { appendActivity, mergePipelineMeta } from "@/lib/pipeline";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";
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
  const [sendingFeeEmail, setSendingFeeEmail] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** Tracks net we last synced so installment re-split runs on net change, not on hydrate. */
  const lastSyncedNetForInstallmentsRef = useRef<number | undefined>(undefined);

  const minDue = todayIsoLocal();

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
    lastSyncedNetForInstallmentsRef.current = undefined;
  }, [lead.id]);

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
  }, [lead.id, feesKey, minDue, lead.pipelineMeta?.fees]);

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

  /** First catalog course selected by default when exam has courses (and when saved id is missing/invalid). */
  useEffect(() => {
    if (!targetExamValue || coursesLoading) return;
    const list = coursesForExam;
    if (list.length === 0) return;
    const valid = list.some((c) => c.id === catalogCourseId);
    if (!catalogCourseId || !valid) {
      setCatalogCourseId(list[0]!.id);
    }
  }, [
    targetExamValue,
    coursesLoading,
    coursesForExam,
    catalogCourseId,
  ]);

  /** Resolved course id for UI, fee lookup, and save (first course when none/invalid). */
  const effectiveCatalogCourseId = useMemo(() => {
    if (!targetExamValue) return "";
    if (coursesLoading) return "";
    if (!coursesForExam.length) return "";
    if (coursesForExam.some((c) => c.id === catalogCourseId)) {
      return catalogCourseId;
    }
    return coursesForExam[0]!.id;
  }, [targetExamValue, coursesLoading, coursesForExam, catalogCourseId]);

  const selectedCourseName = useMemo(() => {
    const list = coursesByExam.get(targetExamValue) ?? [];
    if (!effectiveCatalogCourseId) return "";
    return (
      list.find((c) => c.id === effectiveCatalogCourseId)?.name?.trim() ?? ""
    );
  }, [coursesByExam, targetExamValue, effectiveCatalogCourseId]);

  const finalFromBase = useMemo(() => {
    const b = Math.max(0, Math.round(baseTotal));
    const s = Math.min(100, Math.max(0, scholarshipPct));
    return Math.round(b * (1 - s / 100));
  }, [baseTotal, scholarshipPct]);

  const scholarshipAmountInr = useMemo(() => {
    const gross = Math.max(0, Math.round(baseTotal));
    return Math.max(0, gross - finalFromBase);
  }, [baseTotal, finalFromBase]);

  /** When net total changes (not on first load of rows), re-split equally. */
  useEffect(() => {
    if (installmentRows.length < 2) {
      lastSyncedNetForInstallmentsRef.current = undefined;
      return;
    }
    const prevNet = lastSyncedNetForInstallmentsRef.current;
    if (prevNet === undefined) {
      lastSyncedNetForInstallmentsRef.current = finalFromBase;
      return;
    }
    if (prevNet === finalFromBase) {
      lastSyncedNetForInstallmentsRef.current = finalFromBase;
      return;
    }
    setInstallmentRows((prev) => {
      const parts = equalSplitInr(finalFromBase, prev.length);
      return prev.map((r, i) => ({
        ...r,
        amountInr: parts[i] ?? 0,
        description: "",
      }));
    });
    lastSyncedNetForInstallmentsRef.current = finalFromBase;
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

  const normalizedInstallmentRows = useMemo(
    () =>
      installmentRows.length >= 2
        ? installmentRows.map((r) => ({
            ...r,
            description: "",
            amountInr: Math.max(0, Math.round(Number(r.amountInr) || 0)),
          }))
        : [],
    [installmentRows],
  );

  const hasSavedFeePlan = useMemo(() => {
    const f = (lead.pipelineMeta?.fees ?? {}) as Record<string, unknown>;
    const hasExam =
      typeof f.targetExamValue === "string" && f.targetExamValue.trim().length > 0;
    const hasCourse =
      typeof f.catalogCourseId === "string" && f.catalogCourseId.trim().length > 0;
    const hasBase =
      typeof f.baseTotal === "number" && Number.isFinite(f.baseTotal) && f.baseTotal > 0;
    const hasFinal =
      typeof f.finalFee === "number" && Number.isFinite(f.finalFee) && f.finalFee >= 0;
    const hasInstallments =
      Array.isArray(f.installmentRows) && f.installmentRows.length >= 2;
    return hasExam || hasCourse || hasBase || hasFinal || hasInstallments;
  }, [lead.pipelineMeta?.fees]);

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

  const showScholarshipColumns = scholarshipAmountInr > 0;

  const scholarshipByRowNo = useCallback(
    (lines: ReturnType<typeof buildFeePreviewLines>): Record<number, number> => {
      const out: Record<number, number> = {};
      if (!showScholarshipColumns || scholarshipPct <= 0) {
        for (const row of lines) out[row.no] = 0;
        return out;
      }
      const pct = Math.min(100, Math.max(0, scholarshipPct));
      const rowAfter = lines.map((r) => Math.max(0, Math.round(r.totalInr || 0)));
      const rowAfterSum = rowAfter.reduce((a, b) => a + b, 0);
      if (rowAfterSum <= 0 || pct >= 100) {
        for (const row of lines) out[row.no] = 0;
        return out;
      }
      const gross = Math.round(rowAfterSum / (1 - pct / 100));
      let scholarshipTotal = Math.max(0, gross - rowAfterSum);
      const weighted = lines.map((row, i) => {
        const w = rowAfter[i] ?? 0;
        if (w <= 0) return { no: row.no, base: 0, frac: 0 };
        const exact = (scholarshipTotal * w) / rowAfterSum;
        const base = Math.floor(exact);
        return { no: row.no, base, frac: exact - base };
      });
      for (const x of weighted) out[x.no] = x.base;
      scholarshipTotal -= weighted.reduce((a, b) => a + b.base, 0);
      weighted
        .slice()
        .sort((a, b) => b.frac - a.frac || a.no - b.no)
        .forEach((x, idx) => {
          if (idx < scholarshipTotal) out[x.no] = (out[x.no] ?? 0) + 1;
        });
      return out;
    },
    [showScholarshipColumns, scholarshipPct],
  );

  const pushToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadDefaultFeeFromCatalog = useCallback(async () => {
    if (!targetExamValue || !effectiveCatalogCourseId) return;
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
          String(r.courseId ?? "").trim() === effectiveCatalogCourseId,
      );
      if (hit && typeof hit.baseFee === "number" && hit.baseFee > 0) {
        setBaseTotal(Math.round(hit.baseFee));
      }
    } catch {
      /* ignore */
    }
  }, [targetExamValue, effectiveCatalogCourseId]);

  useEffect(() => {
    void loadDefaultFeeFromCatalog();
  }, [loadDefaultFeeFromCatalog]);

  const startInstallmentsTable = () => {
    const net = Math.max(0, finalFromBase);
    const parts = equalSplitInr(net, 2);
    setInstallmentRows([
      {
        ...newInstallmentRow(),
        amountInr: parts[0] ?? 0,
        dueDate: minDue,
        description: "",
      },
      {
        ...newInstallmentRow(),
        amountInr: parts[1] ?? 0,
        dueDate: defaultSecondDueIso(),
        description: "",
      },
    ]);
  };

  const addInstallment = () => {
    setInstallmentRows((prev) => {
      if (prev.length < 2) {
        const net = Math.max(0, finalFromBase);
        const parts = equalSplitInr(net, 2);
        return [
          {
            ...newInstallmentRow(),
            amountInr: parts[0] ?? 0,
            dueDate: minDue,
            description: "",
          },
          {
            ...newInstallmentRow(),
            amountInr: parts[1] ?? 0,
            dueDate: defaultSecondDueIso(),
            description: "",
          },
        ];
      }
      const net = Math.max(0, finalFromBase);
      const next = [
        ...prev.map((r) => ({ ...r, description: "" })),
        {
          ...newInstallmentRow(),
          dueDate: minDue,
          description: "",
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
      return next.map((r, i) => ({
        ...r,
        amountInr: parts[i] ?? 0,
        description: "",
      }));
    });
  };

  const updateAmountAtIndex = (index: number, rawValue: number) => {
    setInstallmentRows((prev) => {
      if (prev.length < 2 || index < 0 || index >= prev.length) return prev;
      const amounts = prev.map((r) =>
        Math.max(0, Math.round(Number(r.amountInr) || 0)),
      );
      const nextAmounts = redistributeAfterOneAmountEdit(
        amounts,
        finalFromBase,
        index,
        rawValue,
      );
      return prev.map((r, i) => ({
        ...r,
        amountInr: nextAmounts[i] ?? 0,
        description: "",
      }));
    });
  };

  const updateDueDate = (id: string, dueDate: string) => {
    setInstallmentRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, dueDate: !dueDate || dueDate < minDue ? minDue : dueDate } : r,
      ),
    );
  };

  const backToSinglePayment = () => setInstallmentRows([]);

  const feePlanPdfUrl =
    typeof feesMeta.feePlanPdfUrl === "string" && String(feesMeta.feePlanPdfUrl).trim()
      ? String(feesMeta.feePlanPdfUrl).trim()
      : "";
  const feePlanEmailedToParent = Boolean(
    typeof feesMeta.feePlanEmailSentAt === "string" &&
      String(feesMeta.feePlanEmailSentAt).trim(),
  );

  const sendFeePlanToParent = async () => {
    if (!feePlanPdfUrl) {
      pushToast("Save the fee plan and generate the PDF first.");
      return;
    }
    setSendingFeeEmail(true);
    try {
      await sendLeadPipelineEmail(lead.id, { templateKey: "fees" });
      const now = new Date().toISOString();
      await onPatchLead({
        pipelineMeta: mergePipelineMeta(lead.pipelineMeta, {
          fees: {
            ...((lead.pipelineMeta?.fees ?? {}) as object),
            feePlanEmailSentAt: now,
          },
        }),
        activityLog: appendActivity(
          lead.activityLog,
          "fees",
          "Fee plan emailed to parent (Step 3).",
        ),
      });
      await refreshLead();
      pushToast("Fee plan sent to parent.");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Could not send email.");
    } finally {
      setSendingFeeEmail(false);
    }
  };

  const saveFeePlan = async () => {
    setSaving(true);
    try {
      const feesPatch = {
        ...((lead.pipelineMeta?.fees ?? {}) as object),
        targetExamValue,
        catalogCourseId: effectiveCatalogCourseId,
        courseDuration: "",
        customCourseName: selectedCourseName,
        currency,
        scholarshipPct,
        baseTotal: Math.max(0, Math.round(baseTotal)),
        finalFee: effectiveFinalFee,
        feeMasterDueDate:
          installmentRows.length >= 2
            ? null
            : feeMasterDueDate.trim() || null,
        installmentRows: normalizedInstallmentRows,
        installmentEnabled: installmentRows.length >= 2,
        installmentCount: Math.max(installmentRows.length, 1),
        installmentAmounts:
          installmentRows.length >= 2
            ? normalizedInstallmentRows.map((r) => r.amountInr)
            : [],
        installmentDates:
          installmentRows.length >= 2
            ? normalizedInstallmentRows.map((r) => r.dueDate)
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
      const pdfRes = await fetch(`/api/leads/${lead.id}/fee-plan/generate`, {
        method: "POST",
      });
      if (pdfRes.ok) {
        await refreshLead();
        pushToast("Fee plan saved. PDF generated.");
      } else {
        pushToast("Fee plan saved. PDF generation failed.");
      }
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
  ) => {
    const scholarships = scholarshipByRowNo(lines);
    return (
      <div className="mb-3 overflow-hidden rounded-none border border-slate-200 bg-white shadow-none last:mb-0">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
          <h4 className="text-[12px] font-semibold text-slate-900">{title}</h4>
        </div>
        <div className="overflow-x-auto">
          <table className={cn(SX.dataTable, "w-full min-w-[860px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>No.</th>
                <th className={SX.dataTh}>Fee Description</th>
                <th className={SX.dataTh}>GST (Tax)</th>
                {showScholarshipColumns ? (
                  <>
                    <th className={cn(SX.dataTh, "tabular-nums")}>
                      Amount of scholarship (INR)
                    </th>
                    <th className={cn(SX.dataTh, "tabular-nums")}>
                      After Total Amount of Scholarship (INR)
                    </th>
                  </>
                ) : null}
                <th className={cn(SX.dataTh, "tabular-nums")}>Total Amount (USD)</th>
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
                    {showGstColumn
                      ? row.gstApplicable
                        ? formatUsd(inrToUsd(row.gstAmountInr, fx.inrPerUsd))
                        : "No"
                      : "No"}
                  </td>
                  {showScholarshipColumns ? (
                    <>
                      <td className={cn(SX.dataTd, "tabular-nums font-medium")}>
                        {formatInr(scholarships[row.no] ?? 0)}
                      </td>
                      <td className={cn(SX.dataTd, "tabular-nums font-medium")}>
                        {formatInr(row.totalInr)}
                      </td>
                    </>
                  ) : null}
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
      </div>
    );
  };

  const isInstallments = installmentRows.length >= 2;

  return (
    <PipelineStepFrame stepNumber={3} leadId={lead.id}>
      <div className="flex min-h-0 flex-1 flex-col bg-white">
        <div className="border-b border-slate-100 bg-white px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={SX.sectionTitle}>Step 3 - Fees</h2>
              <p className="mt-1 max-w-3xl text-[13px] leading-snug text-slate-600">
                Set catalog course, fee amount, scholarships, installments, and
                bank details. GST and FX for previews come from{" "}
                <Link
                  href="/fee-management"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  Fee management
                </Link>
                .
              </p>
            </div>
            {instLoading ? (
              <span className="shrink-0 text-[11px] text-slate-500">
                Loading rates…
              </span>
            ) : (
              <span className="inline-flex max-w-full shrink-0 items-center rounded-none border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] tabular-nums leading-snug text-slate-800">
                GST {fx.feeGstPercent}% · USD ₹{fx.inrPerUsd.toFixed(2)} · AED ₹
                {fx.inrPerAed.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-4 px-2 py-3 sm:px-3">
          <div
            className={cn(
              SX.section,
              "grid grid-cols-1 gap-x-4 gap-y-3.5 p-3 sm:grid-cols-2 lg:grid-cols-5",
            )}
          >
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
              value={effectiveCatalogCourseId}
              onChange={(e) => setCatalogCourseId(e.target.value)}
              disabled={!targetExamValue || coursesLoading}
            >
              {!targetExamValue ? (
                <option value="">Select an exam first</option>
              ) : coursesLoading ? (
                <option value="">Loading courses…</option>
              ) : coursesForExam.length === 0 ? (
                <option value="">No courses for this exam</option>
              ) : (
                coursesForExam.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="block text-[12px] font-medium text-slate-700">
            <span>Student&apos;s currency</span>
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
          ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-none border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[13px] text-slate-800">
            <span className="text-slate-600">Net: </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatInr(finalFromBase)}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {!isInstallments ? (
              <button
                type="button"
                className={SX.btnSecondary}
                disabled={finalFromBase <= 0}
                onClick={startInstallmentsTable}
              >
                Add installments
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
          <div className="overflow-x-auto rounded-none border border-slate-200 bg-white shadow-none">
            <table className={cn(SX.dataTable, "min-w-[420px]")}>
              <thead>
                <tr>
                  <th className={SX.dataTh}>#</th>
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
                        type="number"
                        min={0}
                        max={finalFromBase}
                        className={cn(SX.input, "w-28 tabular-nums")}
                        value={r.amountInr || ""}
                        onChange={(e) =>
                          updateAmountAtIndex(
                            i,
                            Math.round(Number(e.target.value) || 0),
                          )
                        }
                      />
                    </td>
                    <td className={SX.dataTd}>
                      <input
                        type="date"
                        min={minDue}
                        className={cn(SX.input, "min-w-38 tabular-nums")}
                        value={r.dueDate >= minDue ? r.dueDate : minDue}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateDueDate(
                            r.id,
                            !v || v < minDue ? minDue : v,
                          );
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
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] leading-snug text-slate-600">
              Installments always sum to net ({formatInr(finalFromBase)}).
              Editing one amount redistributes the rest equally.
            </p>
          </div>
        ) : null}

        <details className="group rounded-none border border-slate-200 bg-white shadow-none">
          <summary
            className={cn(
              "cursor-pointer list-none border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] font-semibold text-slate-900",
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
          <div className="bg-slate-50/80 px-3 py-3">
            <p className="mb-2 text-[11px] text-slate-600">
              Options 1–2: no GST. Option 3: NRO with GST @ {fx.feeGstPercent}
              %.
            </p>
            {renderPreviewTable(
              "Option 1 — Pay in USD (No GST)",
              previewLines,
              false,
            )}
            {renderPreviewTable(
              "Option 2 — Indian NRE (No GST)",
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

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            className={cn(
              SX.btnPrimary,
              hasSavedFeePlan &&
                "border-success bg-success hover:bg-[#27692a] shadow-sm shadow-emerald-900/10",
            )}
            disabled={saving || coursesLoading || !targetExamValue}
            onClick={() => void saveFeePlan()}
          >
            {saving ? "Saving…" : hasSavedFeePlan ? "Save again" : "Save fee plan"}
          </button>
          {feePlanPdfUrl ? (
            <a
              href={feePlanPdfUrl}
              target="_blank"
              rel="noreferrer"
              className={SX.btnSecondary}
            >
              Preview PDF
            </a>
          ) : null}
          <button
            type="button"
            className={cn(
              feePlanEmailedToParent ? SX.leadBtnGreen : SX.btnPrimary,
              "h-9 min-w-40 justify-center px-3 text-[12px]",
            )}
            disabled={sendingFeeEmail || !feePlanPdfUrl || coursesLoading}
            onClick={() => void sendFeePlanToParent()}
          >
            {sendingFeeEmail
              ? "Sending…"
              : feePlanEmailedToParent
                ? "Send again"
                : "Email fee plan to parent"}
          </button>
        </div>

        {toast ? (
          <div className="pointer-events-none fixed right-4 top-4 z-260 w-[min(92vw,360px)] rounded-none border border-emerald-300 bg-emerald-50 px-4 py-3 text-[14px] font-semibold text-emerald-900 shadow-md shadow-emerald-900/10">
            {toast}
          </div>
        ) : null}
      </div>
    </PipelineStepFrame>
  );
}
