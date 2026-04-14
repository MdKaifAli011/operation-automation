/** A course track under a target exam (e.g. NEET → Classroom batch). */
export type ExamCourseEntry = {
  id: string;
  examValue: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export const MAX_EXAM_COURSE_ENTRIES = 200;

export function normalizeExamCourseEntries(raw: unknown): ExamCourseEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ExamCourseEntry[] = [];
  const seenId = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const id =
      typeof o.id === "string" ? o.id.trim().slice(0, 64) : "";
    const examValue =
      typeof o.examValue === "string" ? o.examValue.trim().slice(0, 64) : "";
    const name =
      typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
    if (!id || !examValue || !name) continue;
    if (seenId.has(id)) continue;
    seenId.add(id);
    let sortOrder = 0;
    if (typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)) {
      sortOrder = Math.round(o.sortOrder);
    }
    const isActive = o.isActive !== false;
    out.push({ id, examValue, name, sortOrder, isActive });
  }
  out.sort((a, b) => {
    const c = a.examValue.localeCompare(b.examValue);
    return c !== 0 ? c : a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  });
  return out.slice(0, MAX_EXAM_COURSE_ENTRIES);
}
