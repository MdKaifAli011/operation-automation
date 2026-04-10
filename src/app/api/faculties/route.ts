import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  deriveSubjectsAndCoursesFromAssignments,
  sanitizeFacultyAssignments,
} from "@/lib/facultyAssignments";
import { parseFacultyPayload } from "@/lib/parseFacultyPayload";
import { loadExamSubjectCatalog } from "@/lib/serverExamSubjectCatalog";
import FacultyModel from "@/models/Faculty";
import { serializeFaculty } from "@/lib/serializers";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const docs = await FacultyModel.find({}).sort({ name: 1 }).lean();
    return NextResponse.json(
      docs.map((d) =>
        serializeFaculty(d as Parameters<typeof serializeFaculty>[0]),
      ),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load faculty." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseFacultyPayload(json);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    await connectDB();
    let subjects = parsed.subjects;
    let courses = parsed.courses;
    let assignments: { examValue: string; subjectId: string }[] = [];
    if (parsed.assignments !== undefined) {
      const catalog = await loadExamSubjectCatalog();
      assignments = sanitizeFacultyAssignments(parsed.assignments, catalog);
      const derived = deriveSubjectsAndCoursesFromAssignments(
        assignments,
        catalog,
      );
      subjects = derived.subjects;
      courses = derived.courses;
    }

    const doc = await FacultyModel.create({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      assignments,
      subjects,
      courses,
      qualification: parsed.qualification,
      experience: parsed.experience,
      joined: parsed.joined,
      active: parsed.active,
    });
    const lean = doc.toObject();
    return NextResponse.json(
      serializeFaculty({
        _id: lean._id,
        name: lean.name,
        assignments: lean.assignments ?? [],
        subjects: lean.subjects ?? [],
        courses: lean.courses ?? [],
        phone: lean.phone ?? "",
        email: lean.email ?? "",
        active: lean.active ?? true,
        qualification: lean.qualification ?? "",
        experience: lean.experience ?? 0,
        joined: lean.joined ?? "",
      }),
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create faculty." },
      { status: 500 },
    );
  }
}
