import type { LeadPipelineFeeInstallmentRow } from "@/lib/leadPipelineMetaTypes";

export type FeePreviewLine = {
  no: number;
  description: string;
  gstApplicable: boolean;
  gstAmountInr: number;
  baseAmountInr: number;
  totalInr: number;
  dueDate: string;
};

export type InstituteFeeFx = {
  feeGstPercent: number;
  inrPerUsd: number;
  inrPerAed: number;
};

const DEFAULT_LINE_TAIL =
  "Course Fees + Study Material + Test Series + Courier Charges";

export function defaultFeeLineDescription(
  index: number,
  customCourseName: string,
): string {
  const name = customCourseName.trim();
  const prefix = name ? `${index} ${name} — ` : `${index} `;
  return `${prefix}${DEFAULT_LINE_TAIL}`;
}

/** Build preview lines from installments or a single total line. */
export function buildFeePreviewLines(opts: {
  installmentRows: LeadPipelineFeeInstallmentRow[];
  finalFeeInr: number;
  feeMasterDueDate: string;
  customCourseName: string;
}): FeePreviewLine[] {
  const rows = opts.installmentRows.filter(
    (r) => r && String(r.dueDate ?? "").trim() && Number(r.amountInr) > 0,
  );
  if (rows.length > 0) {
    return rows.map((r, i) => ({
      no: i + 1,
      description:
        r.description.trim() ||
        defaultFeeLineDescription(i + 1, opts.customCourseName),
      gstApplicable: false,
      gstAmountInr: 0,
      baseAmountInr: Math.round(Number(r.amountInr) || 0),
      totalInr: Math.round(Number(r.amountInr) || 0),
      dueDate: String(r.dueDate).trim(),
    }));
  }
  const total = Math.max(0, Math.round(opts.finalFeeInr));
  const due = opts.feeMasterDueDate.trim() || "";
  return [
    {
      no: 1,
      description: defaultFeeLineDescription(1, opts.customCourseName),
      gstApplicable: false,
      gstAmountInr: 0,
      baseAmountInr: total,
      totalInr: total,
      dueDate: due,
    },
  ];
}

export function applyGstToLine(
  line: FeePreviewLine,
  gstPercent: number,
): FeePreviewLine {
  const pct = Math.min(100, Math.max(0, gstPercent));
  const base = Math.round(line.baseAmountInr);
  const gstAmountInr = Math.round((base * pct) / 100);
  return {
    ...line,
    gstApplicable: true,
    gstAmountInr,
    totalInr: base + gstAmountInr,
  };
}

export function inrToUsd(amountInr: number, inrPerUsd: number): number {
  const r = inrPerUsd > 0 ? inrPerUsd : 83;
  return amountInr / r;
}

export function inrToAed(amountInr: number, inrPerAed: number): number {
  const r = inrPerAed > 0 ? inrPerAed : 22.5;
  return amountInr / r;
}

export function countryToDisplayCurrency(country: string): "INR" | "USD" | "AED" {
  const c = country.trim().toLowerCase();
  if (!c || c === "india") return "INR";
  if (c.includes("uae") || c.includes("emirates") || c === "ae")
    return "AED";
  return "USD";
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function formatUsd(amount: number): string {
  return `USD ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAed(amount: number): string {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Approximate student-facing amount in their country currency (INR native, else FX). */
export function formatStudentCountryFromInr(
  amountInr: number,
  country: string,
  fx: InstituteFeeFx,
): string {
  const cur = countryToDisplayCurrency(country);
  if (cur === "INR") return formatInr(amountInr);
  if (cur === "AED") return formatAed(inrToAed(amountInr, fx.inrPerAed));
  return formatUsd(inrToUsd(amountInr, fx.inrPerUsd));
}
