/**
 * Shared shapes + migration for exam brochure templates (multiple brochures per exam).
 */

export const LEGACY_BROCHURE_KEY = "default";
export const MAX_BROCHURES_PER_EXAM = 40;

export type BrochureTemplateItem = {
  key: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  storedFileUrl: string | null;
  storedFileName: string | null;
  sortOrder: number;
};

export type ExamBrochureGroupRow = {
  exam: string;
  /** Catalog course id, or "" for legacy exam-only brochure doc */
  courseId: string;
  courseName: string;
  brochures: BrochureTemplateItem[];
  updatedAt: string | null;
};

const KEY_RE = /^[a-zA-Z0-9_-]{1,80}$/;

export function isValidBrochureKey(key: string): boolean {
  return KEY_RE.test(key.trim());
}

/**
 * Map a raw exam id to the configured target exam (case-insensitive).
 * Use so brochure rows match leads & settings when casing differs.
 */
export function resolveCanonicalTargetExam(
  raw: string,
  allowed: readonly string[],
): string | null {
  const t = raw.trim();
  if (!t) return null;
  for (const a of allowed) {
    if (a === t) return a;
  }
  const lower = t.toLowerCase();
  for (const a of allowed) {
    if (a.toLowerCase() === lower) return a;
  }
  return null;
}

/** Find Mongo doc when `exam` column may differ only by case from `wanted`. */
/** Safe string for `new RegExp('^' + escapeRegexLiteral(s) + '$', 'i')`. */
export function escapeRegexLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeBrochureCourseId(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  return "";
}

export function pickBrochureDocByExam<T extends { exam?: string }>(
  docs: T[],
  wanted: string,
): T | undefined {
  return pickBrochureDocByExamAndCourse(docs, wanted, "");
}

/** Match `exam` (case-insensitive) and `courseId` (exact; missing field = ""). */
export function pickBrochureDocByExamAndCourse<
  T extends { exam?: string; courseId?: string },
>(docs: T[], wantedExam: string, wantedCourseId: string): T | undefined {
  const w = wantedExam.trim();
  const wc = normalizeBrochureCourseId(wantedCourseId);
  if (!w) return undefined;
  for (const d of docs) {
    const e = typeof d.exam === "string" ? d.exam.trim() : "";
    const c = normalizeBrochureCourseId(d.courseId);
    if (e === w && c === wc) return d;
  }
  const wl = w.toLowerCase();
  for (const d of docs) {
    const e = typeof d.exam === "string" ? d.exam.trim() : "";
    const c = normalizeBrochureCourseId(d.courseId);
    if (e.toLowerCase() === wl && c === wc) return d;
  }
  return undefined;
}

function normItem(raw: Record<string, unknown>, i: number): BrochureTemplateItem | null {
  const key = typeof raw.key === "string" ? raw.key.trim() : "";
  if (!key || !isValidBrochureKey(key)) return null;
  return {
    key,
    title: typeof raw.title === "string" ? raw.title : "",
    summary: typeof raw.summary === "string" ? raw.summary : "",
    linkUrl: typeof raw.linkUrl === "string" ? raw.linkUrl.trim() : "",
    linkLabel: typeof raw.linkLabel === "string" ? raw.linkLabel.trim() : "",
    storedFileUrl:
      raw.storedFileUrl === null
        ? null
        : typeof raw.storedFileUrl === "string"
          ? raw.storedFileUrl.trim() || null
          : null,
    storedFileName:
      raw.storedFileName === null
        ? null
        : typeof raw.storedFileName === "string"
          ? raw.storedFileName.trim() || null
          : null,
    sortOrder:
      typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder)
        ? raw.sortOrder
        : i,
  };
}

/** Build brochure list from a Mongo lean doc (supports legacy flat fields). */
export function brochureItemsFromDoc(doc: unknown): BrochureTemplateItem[] {
  const d = doc as Record<string, unknown> | null | undefined;
  if (!d) return [];
  const raw = d.brochures;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: BrochureTemplateItem[] = [];
    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      if (row && typeof row === "object") {
        const n = normItem(row as Record<string, unknown>, i);
        if (n) out.push(n);
      }
    }
    out.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
    return dedupeKeys(out);
  }

  const title = typeof d.title === "string" ? d.title : "";
  const summary = typeof d.summary === "string" ? d.summary : "";
  const linkUrl = typeof d.linkUrl === "string" ? d.linkUrl.trim() : "";
  const linkLabel = typeof d.linkLabel === "string" ? d.linkLabel.trim() : "";
  const storedFileUrl =
    typeof d.storedFileUrl === "string" ? d.storedFileUrl.trim() || null : null;
  const storedFileName =
    typeof d.storedFileName === "string" ? d.storedFileName.trim() || null : null;

  const hasLegacy =
    title.trim() ||
    summary.trim() ||
    linkUrl.trim() ||
    linkLabel.trim() ||
    storedFileUrl;

  if (!hasLegacy) return [];

  return [
    {
      key: LEGACY_BROCHURE_KEY,
      title,
      summary,
      linkUrl,
      linkLabel,
      storedFileUrl,
      storedFileName,
      sortOrder: 0,
    },
  ];
}

function dedupeKeys(items: BrochureTemplateItem[]): BrochureTemplateItem[] {
  const seen = new Set<string>();
  const out: BrochureTemplateItem[] = [];
  for (const it of items) {
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(it);
  }
  return out;
}

export function groupRowFromDoc(
  exam: string,
  courseId: string,
  courseName: string,
  doc: unknown,
  updatedAt?: Date | null,
): ExamBrochureGroupRow {
  return {
    exam,
    courseId: normalizeBrochureCourseId(courseId),
    courseName: courseName.trim() || "Course",
    brochures: brochureItemsFromDoc(doc),
    updatedAt: updatedAt?.toISOString() ?? null,
  };
}
