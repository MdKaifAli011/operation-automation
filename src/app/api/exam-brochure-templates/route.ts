import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  brochureItemsFromDoc,
  escapeRegexLiteral,
  pickBrochureDocByExam,
  resolveCanonicalTargetExam,
  type BrochureTemplateItem,
  type ExamBrochureGroupRow,
  MAX_BROCHURES_PER_EXAM,
  isValidBrochureKey,
} from "@/lib/examBrochureTemplates";
import { getActiveTargetExamValues } from "@/lib/serverTargetExams";
import ExamBrochureTemplateModel from "@/models/ExamBrochureTemplate";

export const runtime = "nodejs";

export type { BrochureTemplateItem, ExamBrochureGroupRow };

export async function GET() {
  try {
    const examListActive = await getActiveTargetExamValues();
    await connectDB();
    const docs = await ExamBrochureTemplateModel.find({}).lean();
    const activeLower = new Set(
      examListActive.map((e) => e.toLowerCase()),
    );
    const orphans: string[] = [];
    for (const d of docs) {
      const raw = typeof d.exam === "string" ? d.exam.trim() : "";
      if (!raw) continue;
      if (!activeLower.has(raw.toLowerCase())) {
        orphans.push(raw);
      }
    }
    orphans.sort((a, b) => a.localeCompare(b));
    const examList = [...examListActive, ...orphans];
    const rows: ExamBrochureGroupRow[] = examList.map((exam) => {
      const hit = pickBrochureDocByExam(docs, exam);
      const updatedAt = hit?.updatedAt as Date | undefined;
      return {
        exam,
        brochures: brochureItemsFromDoc(hit ?? null),
        updatedAt: updatedAt?.toISOString() ?? null,
      };
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load exam brochure templates." },
      { status: 500 },
    );
  }
}

type PutBody = {
  items?: Array<{
    exam?: string;
    brochures?: unknown;
  }>;
};

function parseBrochuresPayload(raw: unknown): BrochureTemplateItem[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > MAX_BROCHURES_PER_EXAM) return null;
  const keys = new Set<string>();
  const out: BrochureTemplateItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const key = typeof o.key === "string" ? o.key.trim() : "";
    if (!key || !isValidBrochureKey(key) || keys.has(key)) return null;
    keys.add(key);
    out.push({
      key,
      title: typeof o.title === "string" ? o.title : "",
      summary: typeof o.summary === "string" ? o.summary : "",
      linkUrl: typeof o.linkUrl === "string" ? o.linkUrl.trim() : "",
      linkLabel: typeof o.linkLabel === "string" ? o.linkLabel.trim() : "",
      storedFileUrl:
        o.storedFileUrl === null
          ? null
          : typeof o.storedFileUrl === "string"
            ? o.storedFileUrl.trim() || null
            : null,
      storedFileName:
        o.storedFileName === null
          ? null
          : typeof o.storedFileName === "string"
            ? o.storedFileName.trim() || null
            : null,
      sortOrder:
        typeof o.sortOrder === "number" && Number.isFinite(o.sortOrder)
          ? o.sortOrder
          : i,
    });
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
  return out;
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items?.length) {
      return NextResponse.json(
        {
          error:
            "Expected body: { items: [{ exam, brochures: [{ key, title?, … }] }] }",
        },
        { status: 400 },
      );
    }
    await connectDB();
    const allowedList = await getActiveTargetExamValues();
    for (const raw of items) {
      const rawExam = typeof raw.exam === "string" ? raw.exam.trim() : "";
      const exam = rawExam
        ? resolveCanonicalTargetExam(rawExam, allowedList)
        : null;
      if (!exam) {
        return NextResponse.json(
          {
            error: rawExam
              ? `Exam "${rawExam}" is not an active target exam. Add or enable it under Exams & subjects.`
              : "Missing exam on an item.",
          },
          { status: 400 },
        );
      }
      const brochures = parseBrochuresPayload(raw.brochures);
      if (brochures === null) {
        return NextResponse.json(
          {
            error: `Invalid brochures for ${exam}: max ${MAX_BROCHURES_PER_EXAM} items, unique keys (alphanumeric, _ -).`,
          },
          { status: 400 },
        );
      }
      const existing = await ExamBrochureTemplateModel.findOne({
        exam: new RegExp(`^${escapeRegexLiteral(exam)}$`, "i"),
      }).lean();
      const filter = existing?._id
        ? { _id: existing._id }
        : { exam };
      await ExamBrochureTemplateModel.findOneAndUpdate(
        filter,
        {
          $set: { exam, brochures },
          $unset: {
            title: "",
            summary: "",
            linkUrl: "",
            linkLabel: "",
            storedFileUrl: "",
            storedFileName: "",
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    }
    const docs = await ExamBrochureTemplateModel.find({}).lean();
    const examListActive = await getActiveTargetExamValues();
    const activeLower = new Set(
      examListActive.map((e) => e.toLowerCase()),
    );
    const orphans: string[] = [];
    for (const d of docs) {
      const raw = typeof d.exam === "string" ? d.exam.trim() : "";
      if (!raw) continue;
      if (!activeLower.has(raw.toLowerCase())) {
        orphans.push(raw);
      }
    }
    orphans.sort((a, b) => a.localeCompare(b));
    const examList = [...examListActive, ...orphans];
    const rows: ExamBrochureGroupRow[] = examList.map((exam) => {
      const hit = pickBrochureDocByExam(docs, exam);
      const updatedAt = hit?.updatedAt as Date | undefined;
      return {
        exam,
        brochures: brochureItemsFromDoc(hit ?? null),
        updatedAt: updatedAt?.toISOString() ?? null,
      };
    });
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save exam brochure templates." },
      { status: 500 },
    );
  }
}
