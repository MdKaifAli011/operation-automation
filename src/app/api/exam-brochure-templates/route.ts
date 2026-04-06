import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import ExamBrochureTemplateModel from "@/models/ExamBrochureTemplate";

export const runtime = "nodejs";

export type ExamBrochureTemplateRow = {
  exam: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  updatedAt?: string | null;
};

export async function GET() {
  try {
    await connectDB();
    const docs = await ExamBrochureTemplateModel.find({}).lean();
    const byExam = new Map<
      string,
      {
        title: string;
        summary: string;
        linkUrl: string;
        linkLabel: string;
        updatedAt?: Date;
      }
    >();
    for (const d of docs) {
      byExam.set(d.exam, {
        title: typeof d.title === "string" ? d.title : "",
        summary: typeof d.summary === "string" ? d.summary : "",
        linkUrl: typeof d.linkUrl === "string" ? d.linkUrl : "",
        linkLabel: typeof d.linkLabel === "string" ? d.linkLabel : "",
        updatedAt: d.updatedAt,
      });
    }
    const rows: ExamBrochureTemplateRow[] = TARGET_EXAM_OPTIONS.map((exam) => {
      const hit = byExam.get(exam);
      return {
        exam,
        title: hit?.title ?? "",
        summary: hit?.summary ?? "",
        linkUrl: hit?.linkUrl ?? "",
        linkLabel: hit?.linkLabel ?? "",
        updatedAt: hit?.updatedAt?.toISOString() ?? null,
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
    title?: string;
    summary?: string;
    linkUrl?: string;
    linkLabel?: string;
  }>;
};

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as PutBody;
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items?.length) {
      return NextResponse.json(
        { error: "Expected body: { items: [{ exam, title?, summary?, linkUrl? }] }" },
        { status: 400 },
      );
    }
    await connectDB();
    const allowed = new Set<string>([...TARGET_EXAM_OPTIONS]);
    for (const raw of items) {
      const exam = typeof raw.exam === "string" ? raw.exam.trim() : "";
      if (!exam || !allowed.has(exam)) continue;
      const title = typeof raw.title === "string" ? raw.title.trim() : "";
      const summary = typeof raw.summary === "string" ? raw.summary : "";
      const linkUrl = typeof raw.linkUrl === "string" ? raw.linkUrl.trim() : "";
      const linkLabel = typeof raw.linkLabel === "string" ? raw.linkLabel.trim() : "";
      await ExamBrochureTemplateModel.findOneAndUpdate(
        { exam },
        { $set: { exam, title, summary, linkUrl, linkLabel } },
        { upsert: true, new: true },
      );
    }
    const docs = await ExamBrochureTemplateModel.find({}).lean();
    const byExam = new Map<
      string,
      {
        title: string;
        summary: string;
        linkUrl: string;
        linkLabel: string;
        updatedAt?: Date;
      }
    >();
    for (const d of docs) {
      byExam.set(d.exam, {
        title: typeof d.title === "string" ? d.title : "",
        summary: typeof d.summary === "string" ? d.summary : "",
        linkUrl: typeof d.linkUrl === "string" ? d.linkUrl : "",
        linkLabel: typeof d.linkLabel === "string" ? d.linkLabel : "",
        updatedAt: d.updatedAt,
      });
    }
    const rows: ExamBrochureTemplateRow[] = TARGET_EXAM_OPTIONS.map((exam) => {
      const hit = byExam.get(exam);
      return {
        exam,
        title: hit?.title ?? "",
        summary: hit?.summary ?? "",
        linkUrl: hit?.linkUrl ?? "",
        linkLabel: hit?.linkLabel ?? "",
        updatedAt: hit?.updatedAt?.toISOString() ?? null,
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
