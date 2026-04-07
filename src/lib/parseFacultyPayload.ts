/** Shared body parser for POST /api/faculties and PATCH /api/faculties/[id]. */

export type FacultyPayload = {
  name: string;
  email: string;
  phone: string;
  subjects: string[];
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
    qualification,
    experience,
    joined,
    active,
  };
}
