import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  activeTargetExamValues,
  DEFAULT_TARGET_EXAM_OPTIONS,
  normalizeTargetExams,
  type TargetExamOption,
} from "@/lib/targetExams";
import TargetExamSettingsModel from "@/models/TargetExamSettings";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await connectDB();
    const doc = await TargetExamSettingsModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    const exams = normalizeTargetExams(doc?.exams);
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ exams, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load target exam settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.exams;
    const exams = normalizeTargetExams(raw);
    if (activeTargetExamValues(exams).length === 0) {
      return NextResponse.json(
        { error: "At least one active target course/exam is required." },
        { status: 400 },
      );
    }
    await connectDB();
    const doc = await TargetExamSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { exams } },
      { upsert: true, new: true },
    )
      .lean()
      .exec();
    const saved = normalizeTargetExams(
      (doc as { exams?: unknown } | null)?.exams,
    );
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ exams: saved, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save target exam settings." },
      { status: 500 },
    );
  }
}

/** Restore built-in defaults in DB. */
export async function DELETE() {
  try {
    const exams: TargetExamOption[] = DEFAULT_TARGET_EXAM_OPTIONS.map((o) => ({
      ...o,
    }));
    await connectDB();
    const doc = await TargetExamSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { exams } },
      { upsert: true, new: true },
    )
      .lean()
      .exec();
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ exams, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not reset target exam settings." },
      { status: 500 },
    );
  }
}
