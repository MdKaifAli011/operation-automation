import connectDB from "@/lib/mongodb";
import FacultyModel from "@/models/Faculty";

/** Resolves the faculty email for a teacher display name (exact match, then case-insensitive). */
export async function resolveTeacherEmailFromFacultyName(
  teacherName: string,
): Promise<string | undefined> {
  const t = teacherName.trim();
  if (!t) return;
  await connectDB();
  const exact = await FacultyModel.findOne({ name: t, active: true }).select("email").lean();
  const e0 = typeof exact?.email === "string" ? exact.email.trim() : "";
  if (e0) return e0;

  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ci = await FacultyModel.findOne({
    active: true,
    name: { $regex: new RegExp(`^${escaped}$`, "i") },
  })
    .select("email")
    .lean();
  const e1 = typeof ci?.email === "string" ? ci.email.trim() : "";
  if (e1) return e1;
  return undefined;
}
