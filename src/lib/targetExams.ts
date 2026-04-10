/** Target courses / exams (NEET, JEE, …) — configurable under Exams & subjects. */

export const FALLBACK_TARGET_EXAM_VALUES = [
  "NEET",
  "JEE",
  "CUET",
  "SAT",
  "Other",
] as const;

export type TargetExamOption = {
  /** Stored on leads, fee rows, brochure keys — stable id (e.g. NEET). */
  value: string;
  /** Display label (can differ from value). */
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export const DEFAULT_TARGET_EXAM_OPTIONS: TargetExamOption[] =
  FALLBACK_TARGET_EXAM_VALUES.map((value, i) => ({
    value,
    label: value,
    sortOrder: i,
    isActive: true,
  }));

const MAX_EXAMS = 40;
const VALUE_RE = /^[a-zA-Z0-9][a-zA-Z0-9 _.-]{0,62}$/;

/** Stable id for API / DB (from exam display name). */
export function slugifyExamStoredValue(raw: string): string {
  const t = raw.trim().replace(/\s+/g, "_");
  if (!t) return "";
  if (VALUE_RE.test(t)) return t.slice(0, 64);
  return t
    .replace(/[^a-zA-Z0-9 _.-]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 64);
}

export function normalizeTargetExams(raw: unknown): TargetExamOption[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_TARGET_EXAM_OPTIONS.map((o) => ({ ...o }));
  }
  const seen = new Set<string>();
  const out: TargetExamOption[] = [];
  for (let i = 0; i < raw.length && out.length < MAX_EXAMS; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    let value =
      typeof o.value === "string" ? o.value.trim().slice(0, 64) : "";
    if (!value && typeof o.label === "string") {
      value = slugifyExamStoredValue(o.label);
    }
    if (!value || seen.has(value)) continue;
    const label =
      typeof o.label === "string" && o.label.trim()
        ? o.label.trim().slice(0, 120)
        : value;
    const sortOrder =
      typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)
        ? o.sortOrder
        : i;
    const isActive = o.isActive !== false;
    seen.add(value);
    out.push({ value, label, sortOrder, isActive });
  }
  out.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  return out.length > 0
    ? out
    : DEFAULT_TARGET_EXAM_OPTIONS.map((x) => ({ ...x }));
}

export function activeTargetExamValues(opts: TargetExamOption[]): string[] {
  return opts
    .filter((o) => o.isActive)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
    )
    .map((o) => o.value);
}
