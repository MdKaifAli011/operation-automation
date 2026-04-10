import mongoose from "mongoose";
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectDB();
    const doc = await FacultyModel.findById(id).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json(
      serializeFaculty(doc as Parameters<typeof serializeFaculty>[0]),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load faculty." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

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

    await connectDB();

    let setDoc: Record<string, unknown> = {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      qualification: parsed.qualification,
      experience: parsed.experience,
      joined: parsed.joined,
      active: parsed.active,
    };

    if (parsed.assignments !== undefined) {
      const catalog = await loadExamSubjectCatalog();
      const assignments = sanitizeFacultyAssignments(
        parsed.assignments,
        catalog,
      );
      const derived = deriveSubjectsAndCoursesFromAssignments(
        assignments,
        catalog,
      );
      setDoc = {
        ...setDoc,
        assignments,
        subjects: derived.subjects,
        courses: derived.courses,
      };
    } else {
      setDoc = {
        ...setDoc,
        subjects: parsed.subjects,
        courses: parsed.courses,
      };
    }

    const doc = await FacultyModel.findByIdAndUpdate(
      id,
      { $set: setDoc },
      { new: true, runValidators: true },
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(
      serializeFaculty(doc as Parameters<typeof serializeFaculty>[0]),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not update faculty." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    await connectDB();
    const result = await FacultyModel.findByIdAndDelete(id);
    if (!result) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not delete faculty." },
      { status: 500 },
    );
  }
}
