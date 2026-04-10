import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  MAX_EXAM_SUBJECT_ENTRIES,
  normalizeExamSubjectEntries,
  type ExamSubjectEntry,
} from "@/lib/examSubjectTypes";
import ExamSubjectCatalogModel from "@/models/ExamSubjectCatalog";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await connectDB();
    const doc = await ExamSubjectCatalogModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    const subjects = normalizeExamSubjectEntries(doc?.subjects);
    return NextResponse.json({
      subjects,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load exam subjects." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const raw = (body as Record<string, unknown>).subjects;
    let subjects = normalizeExamSubjectEntries(raw);
    if (subjects.length > MAX_EXAM_SUBJECT_ENTRIES) {
      return NextResponse.json(
        {
          error: `At most ${MAX_EXAM_SUBJECT_ENTRIES} subject rows allowed.`,
        },
        { status: 400 },
      );
    }

    await connectDB();
    const doc = await ExamSubjectCatalogModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { subjects: subjects as ExamSubjectEntry[] } },
      { upsert: true, new: true, runValidators: true },
    )
      .lean()
      .exec();

    subjects = normalizeExamSubjectEntries(doc?.subjects);
    return NextResponse.json({
      subjects,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save exam subjects." },
      { status: 500 },
    );
  }
}
