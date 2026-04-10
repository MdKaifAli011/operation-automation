import type { ExamSubjectEntry } from "@/lib/examSubjectTypes";
import type { FacultyAssignment } from "@/lib/types";

function assignmentKey(a: FacultyAssignment): string {
  return `${a.examValue}\0${a.subjectId}`;
}

/** Dedupe pairs, keep only assignments whose subject exists in catalog for that exam. */
export function sanitizeFacultyAssignments(
  raw: unknown,
  catalog: ExamSubjectEntry[],
): FacultyAssignment[] {
  if (!Array.isArray(raw)) return [];
  const catalogHit = new Map<string, ExamSubjectEntry>();
  for (const e of catalog) {
    catalogHit.set(`${e.examValue}\0${e.id}`, e);
  }
  const seen = new Set<string>();
  const out: FacultyAssignment[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const examValue =
      typeof o.examValue === "string" ? o.examValue.trim().slice(0, 64) : "";
    const subjectId =
      typeof o.subjectId === "string" ? o.subjectId.trim().slice(0, 64) : "";
    if (!examValue || !subjectId) continue;
    const entry = catalogHit.get(`${examValue}\0${subjectId}`);
    if (!entry || entry.isActive === false) continue;
    const k = assignmentKey({ examValue, subjectId });
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ examValue, subjectId });
  }
  return out;
}

export function deriveSubjectsAndCoursesFromAssignments(
  assignments: FacultyAssignment[],
  catalog: ExamSubjectEntry[],
): { subjects: string[]; courses: string[] } {
  const byId = new Map(catalog.map((e) => [e.id, e] as const));
  const subjectNames = new Set<string>();
  const courses = new Set<string>();
  for (const a of assignments) {
    courses.add(a.examValue);
    const entry = byId.get(a.subjectId);
    if (!entry || entry.isActive === false) continue;
    const n = entry.name.trim();
    if (n) subjectNames.add(n);
  }
  return {
    subjects: [...subjectNames].sort((a, b) => a.localeCompare(b)),
    courses: [...courses].sort((a, b) => a.localeCompare(b)),
  };
}
