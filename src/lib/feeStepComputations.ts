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
  courseLabel: string,
): string {
  const name = courseLabel.trim();
  const prefix = name ? `${index}. ${name} — ` : `${index}. `;
  return `${prefix}${DEFAULT_LINE_TAIL}`;
}

/** Equal split of `net` into `n` whole rupees (remainder on earliest rows). */
export function equalSplitInr(net: number, n: number): number[] {
  const total = Math.max(0, Math.round(net));
  if (n <= 0) return [];
  if (n === 1) return [total];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + (i < remainder ? 1 : 0));
  }
  return out;
}

/** Keep first n−1 amounts; last row absorbs remainder so sum === net. */
export function balanceInstallmentAmounts(
  rows: LeadPipelineFeeInstallmentRow[],
  net: number,
): LeadPipelineFeeInstallmentRow[] {
  if (rows.length < 2) return rows;
  const n = rows.length;
  const target = Math.max(0, Math.round(net));
  let sumHead = 0;
  const copy = rows.map((r) => ({ ...r }));
  for (let i = 0; i < n - 1; i++) {
    sumHead += Math.max(0, Math.round(Number(copy[i].amountInr) || 0));
  }
  copy[n - 1]!.amountInr = Math.max(0, target - sumHead);
  return copy;
}

/**
 * User edits one installment amount; that row is set (clamped to net);
 * the remaining total is split equally across all other rows. Sum always equals `net`.
 */
export function redistributeAfterOneAmountEdit(
  currentAmounts: number[],
  net: number,
  editedIndex: number,
  rawValue: number,
): number[] {
  const n = currentAmounts.length;
  if (n < 2 || editedIndex < 0 || editedIndex >= n) return currentAmounts;
  const target = Math.max(0, Math.round(net));
  let v = Math.max(0, Math.round(Number(rawValue) || 0));
  v = Math.min(v, target);
  const remaining = target - v;
  const parts = equalSplitInr(remaining, n - 1);
  const out: number[] = new Array(n).fill(0);
  let j = 0;
  for (let i = 0; i < n; i++) {
    if (i === editedIndex) {
      out[i] = v;
    } else {
      out[i] = parts[j++] ?? 0;
    }
  }
  const sum = out.reduce((a, b) => a + b, 0);
  if (sum !== target) {
    out[editedIndex] += target - sum;
  }
  return out;
}

/** Build preview lines from installments or a single total line. */
export function buildFeePreviewLines(opts: {
  installmentRows: LeadPipelineFeeInstallmentRow[];
  finalFeeInr: number;
  feeMasterDueDate: string;
  courseLabel: string;
}): FeePreviewLine[] {
  const rows = opts.installmentRows.filter(
    (r) => r && String(r.dueDate ?? "").trim() && Number(r.amountInr) > 0,
  );
  if (rows.length > 0) {
    return rows.map((r, i) => ({
      no: i + 1,
      description:
        r.description.trim() ||
        defaultFeeLineDescription(i + 1, opts.courseLabel),
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
      description: defaultFeeLineDescription(1, opts.courseLabel),
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
