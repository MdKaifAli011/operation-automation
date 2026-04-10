/** Shared body parser for POST /api/faculties and PATCH /api/faculties/[id]. */

export type FacultyAssignmentPayload = {
  examValue: string;
  subjectId: string;
};

export type FacultyPayload = {
  name: string;
  email: string;
  phone: string;
  subjects: string[];
  /** Target exam/course ids (e.g. NEET). */
  courses: string[];
  /**
   * When present, server replaces teaching with these pairs and re-derives
   * `subjects` / `courses` from the exam-subject catalog.
   */
  assignments?: FacultyAssignmentPayload[];
  qualification: string;
  experience: number;
  joined: string;
  active: boolean;
};

export function parseFacultyPayload(
  body: unknown,
): FacultyPayload | { error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) {
    return { error: "Name is required." };
  }

  const email = typeof b.email === "string" ? b.email.trim() : "";
  const phone =
    typeof b.phone === "string" ? b.phone.replace(/\s+/g, "").trim() : "";

  let subjects: string[] = [];
  if (Array.isArray(b.subjects)) {
    subjects = b.subjects
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  }

  let courses: string[] = [];
  if (Array.isArray(b.courses)) {
    courses = b.courses
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
  }

  let assignments: FacultyAssignmentPayload[] | undefined;
  if ("assignments" in b) {
    if (!Array.isArray(b.assignments)) {
      return { error: "assignments must be an array." };
    }
    const pairs: FacultyAssignmentPayload[] = [];
    for (const row of b.assignments) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const o = row as Record<string, unknown>;
      const examValue =
        typeof o.examValue === "string" ? o.examValue.trim().slice(0, 64) : "";
      const subjectId =
        typeof o.subjectId === "string" ? o.subjectId.trim().slice(0, 64) : "";
      if (!examValue || !subjectId) continue;
      pairs.push({ examValue, subjectId });
    }
    assignments = pairs;
  }

  const qualification =
    typeof b.qualification === "string" ? b.qualification.trim() : "";

  let experience = 0;
  if (typeof b.experience === "number" && Number.isFinite(b.experience)) {
    experience = Math.max(0, Math.round(b.experience));
  } else if (typeof b.experience === "string" && b.experience.trim()) {
    const n = parseInt(b.experience, 10);
    if (!Number.isNaN(n)) experience = Math.max(0, n);
  }

  const joined = typeof b.joined === "string" ? b.joined.trim() : "";

  const active = b.active !== false;

  return {
    name,
    email,
    phone,
    subjects,
    courses,
    ...(assignments !== undefined ? { assignments } : {}),
    qualification,
    experience,
    joined,
    active,
  };
}
