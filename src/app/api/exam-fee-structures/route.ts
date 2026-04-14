import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getActiveTargetExamValues } from "@/lib/serverTargetExams";
import { getExamCourseCatalog } from "@/lib/serverExamCourseCatalog";
import ExamCourseFeeStructureModel from "@/models/ExamCourseFeeStructure";
import ExamFeeStructureModel from "@/models/ExamFeeStructure";

export const runtime = "nodejs";

export type ExamCourseFeeRow = {
  exam: string;
  courseId: string;
  courseName: string;
  baseFee: number;
  notes: string;
  updatedAt?: string | null;
};

/** GET: one row per (exam × catalog course); merge legacy per-exam fee when no course row exists. */
export async function GET() {
  try {
    const examList = await getActiveTargetExamValues();
    const catalog = await getExamCourseCatalog();
    await connectDB();

    const legacyDocs = await ExamFeeStructureModel.find({}).lean();
    const legacyByExam = new Map<string, { baseFee: number; notes: string }>();
    for (const d of legacyDocs) {
      const ex = typeof d.exam === "string" ? d.exam.trim() : "";
      if (!ex) continue;
      legacyByExam.set(ex, {
        baseFee: typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
          ? Math.max(0, Math.round(d.baseFee))
          : 0,
        notes: typeof d.notes === "string" ? d.notes : "",
      });
    }

    const courseDocs = await ExamCourseFeeStructureModel.find({}).lean();
    const byKey = new Map<
      string,
      { baseFee: number; notes: string; updatedAt?: Date }
    >();
    for (const d of courseDocs) {
      const ex = typeof d.exam === "string" ? d.exam.trim() : "";
      const cid = typeof d.courseId === "string" ? d.courseId.trim() : "";
      if (!ex || !cid) continue;
      byKey.set(`${ex}::${cid}`, {
        baseFee:
          typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
            ? Math.max(0, Math.round(d.baseFee))
            : 0,
        notes: typeof d.notes === "string" ? d.notes : "",
        updatedAt: d.updatedAt,
      });
    }

    const rows: ExamCourseFeeRow[] = [];

    for (const exam of examList) {
      const courses = catalog
        .filter(
          (c) =>
            c.examValue === exam ||
            c.examValue.toLowerCase() === exam.toLowerCase(),
        )
        .filter((c) => c.isActive !== false)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        );

      const leg = legacyByExam.get(exam);

      if (courses.length === 0) {
        rows.push({
          exam,
          courseId: "",
          courseName: "— Add courses under Exam courses",
          baseFee: leg?.baseFee ?? 0,
          notes: leg?.notes ?? "",
          updatedAt: null,
        });
        continue;
      }

      for (const c of courses) {
        const hit = byKey.get(`${exam}::${c.id}`);
        rows.push({
          exam,
          courseId: c.id,
          courseName: c.name,
          baseFee: hit?.baseFee ?? leg?.baseFee ?? 0,
          notes: hit?.notes ?? "",
          updatedAt: hit?.updatedAt?.toISOString() ?? null,
        });
      }
    }

    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load exam fee structures." },
      { status: 500 },
    );
  }
}

type PutBody = {
  items?: Array<{
    exam?: string;
    courseId?: string;
    baseFee?: unknown;
    notes?: string;
  }>;
};

/** PUT: upsert course-level fees (skips rows with empty courseId). */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items?.length) {
      return NextResponse.json(
        { error: "Expected body: { items: [{ exam, courseId, baseFee, notes? }] }" },
        { status: 400 },
      );
    }
    await connectDB();
    const allowed = new Set<string>(await getActiveTargetExamValues());
    const catalog = await getExamCourseCatalog();
    const catalogIds = new Set(catalog.map((c) => c.id));

    for (const raw of items) {
      const exam =
        typeof raw.exam === "string" ? raw.exam.trim() : "";
      const courseId =
        typeof raw.courseId === "string" ? raw.courseId.trim() : "";
      if (!exam || !allowed.has(exam) || !courseId) {
        continue;
      }
      if (!catalogIds.has(courseId)) continue;
      const owns = catalog.some(
        (c) =>
          c.id === courseId &&
          (c.examValue === exam || c.examValue.toLowerCase() === exam.toLowerCase()),
      );
      if (!owns) continue;

      const n = Number(raw.baseFee);
      const baseFee = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
      const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
      await ExamCourseFeeStructureModel.findOneAndUpdate(
        { exam, courseId },
        { $set: { exam, courseId, baseFee, notes } },
        { upsert: true, returnDocument: "after" },
      );
    }

    const res = await GET();
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save exam fee structures." },
      { status: 500 },
    );
  }
}
