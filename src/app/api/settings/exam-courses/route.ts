import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  MAX_EXAM_COURSE_ENTRIES,
  normalizeExamCourseEntries,
  type ExamCourseEntry,
} from "@/lib/examCourseTypes";
import ExamCourseCatalogModel from "@/models/ExamCourseCatalog";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await connectDB();
    const doc = await ExamCourseCatalogModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    const courses = normalizeExamCourseEntries(doc?.courses);
    return NextResponse.json({
      courses,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load exam courses." },
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
    const raw = (body as Record<string, unknown>).courses;
    let courses = normalizeExamCourseEntries(raw);
    if (courses.length > MAX_EXAM_COURSE_ENTRIES) {
      return NextResponse.json(
        {
          error: `At most ${MAX_EXAM_COURSE_ENTRIES} course rows allowed.`,
        },
        { status: 400 },
      );
    }

    await connectDB();
    const doc = await ExamCourseCatalogModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { courses: courses as ExamCourseEntry[] } },
      { upsert: true, new: true, runValidators: true },
    )
      .lean()
      .exec();

    courses = normalizeExamCourseEntries(doc?.courses);
    return NextResponse.json({
      courses,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save exam courses." },
      { status: 500 },
    );
  }
}
