import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getActiveTargetExamValues } from "@/lib/serverTargetExams";
import ExamFeeStructureModel from "@/models/ExamFeeStructure";

export const runtime = "nodejs";

export type ExamFeeStructureRow = {
  exam: string;
  baseFee: number;
  notes?: string;
  updatedAt?: string | null;
};

/** GET: one row per known exam; merge with DB (missing → baseFee 0). */
export async function GET() {
  try {
    const examList = await getActiveTargetExamValues();
    await connectDB();
    const docs = await ExamFeeStructureModel.find({}).lean();
    const byExam = new Map<string, { baseFee: number; notes: string; updatedAt?: Date }>();
    for (const d of docs) {
      byExam.set(d.exam, {
        baseFee: d.baseFee,
        notes: typeof d.notes === "string" ? d.notes : "",
        updatedAt: d.updatedAt,
      });
    }
    const rows: ExamFeeStructureRow[] = examList.map((exam) => {
      const hit = byExam.get(exam);
      return {
        exam,
        baseFee: hit?.baseFee ?? 0,
        notes: hit?.notes ?? "",
        updatedAt: hit?.updatedAt?.toISOString() ?? null,
      };
    });
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
  items?: Array<{ exam?: string; baseFee?: unknown; notes?: string }>;
};

/** PUT: upsert each item (exam + baseFee). */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items?.length) {
      return NextResponse.json(
        { error: "Expected body: { items: [{ exam, baseFee }] }" },
        { status: 400 },
      );
    }
    await connectDB();
    const allowed = new Set<string>(await getActiveTargetExamValues());
    for (const raw of items) {
      const exam =
        typeof raw.exam === "string" ? raw.exam.trim() : "";
      if (!exam || !allowed.has(exam)) {
        continue;
      }
      const n = Number(raw.baseFee);
      const baseFee = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
      const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
      await ExamFeeStructureModel.findOneAndUpdate(
        { exam },
        { $set: { exam, baseFee, notes } },
        { upsert: true, returnDocument: "after" },
      );
    }
    const docs = await ExamFeeStructureModel.find({}).lean();
    const byExam = new Map<string, { baseFee: number; notes: string; updatedAt?: Date }>();
    for (const d of docs) {
      byExam.set(d.exam, {
        baseFee: d.baseFee,
        notes: typeof d.notes === "string" ? d.notes : "",
        updatedAt: d.updatedAt,
      });
    }
    const examList = await getActiveTargetExamValues();
    const rows: ExamFeeStructureRow[] = examList.map((exam) => {
      const hit = byExam.get(exam);
      return {
        exam,
        baseFee: hit?.baseFee ?? 0,
        notes: hit?.notes ?? "",
        updatedAt: hit?.updatedAt?.toISOString() ?? null,
      };
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save exam fee structures." },
      { status: 500 },
    );
  }
}
