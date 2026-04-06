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
  storedFileUrl?: string | null;
  storedFileName?: string | null;
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
        storedFileUrl: string | null;
        storedFileName: string | null;
        updatedAt?: Date;
      }
    >();
    for (const d of docs) {
      byExam.set(d.exam, {
        title: typeof d.title === "string" ? d.title : "",
        summary: typeof d.summary === "string" ? d.summary : "",
        linkUrl: typeof d.linkUrl === "string" ? d.linkUrl : "",
        linkLabel: typeof d.linkLabel === "string" ? d.linkLabel : "",
        storedFileUrl:
          typeof (d as { storedFileUrl?: string | null }).storedFileUrl ===
          "string"
            ? (d as { storedFileUrl?: string | null }).storedFileUrl ?? null
            : null,
        storedFileName:
          typeof (d as { storedFileName?: string | null }).storedFileName ===
          "string"
            ? (d as { storedFileName?: string | null }).storedFileName ?? null
            : null,
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
        storedFileUrl: hit?.storedFileUrl ?? null,
        storedFileName: hit?.storedFileName ?? null,
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
    storedFileUrl?: string | null;
    storedFileName?: string | null;
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
      const storedFileUrl =
        raw.storedFileUrl === null
          ? null
          : typeof raw.storedFileUrl === "string"
            ? raw.storedFileUrl.trim() || null
            : undefined;
      const storedFileName =
        raw.storedFileName === null
          ? null
          : typeof raw.storedFileName === "string"
            ? raw.storedFileName.trim() || null
            : undefined;
      const setDoc: Record<string, unknown> = { exam, title, summary, linkUrl, linkLabel };
      if (storedFileUrl !== undefined) setDoc.storedFileUrl = storedFileUrl;
      if (storedFileName !== undefined) setDoc.storedFileName = storedFileName;
      await ExamBrochureTemplateModel.findOneAndUpdate(
        { exam },
        { $set: setDoc },
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
        storedFileUrl: string | null;
        storedFileName: string | null;
        updatedAt?: Date;
      }
    >();
    for (const d of docs) {
      byExam.set(d.exam, {
        title: typeof d.title === "string" ? d.title : "",
        summary: typeof d.summary === "string" ? d.summary : "",
        linkUrl: typeof d.linkUrl === "string" ? d.linkUrl : "",
        linkLabel: typeof d.linkLabel === "string" ? d.linkLabel : "",
        storedFileUrl:
          typeof (d as { storedFileUrl?: string | null }).storedFileUrl ===
          "string"
            ? (d as { storedFileUrl?: string | null }).storedFileUrl ?? null
            : null,
        storedFileName:
          typeof (d as { storedFileName?: string | null }).storedFileName ===
          "string"
            ? (d as { storedFileName?: string | null }).storedFileName ?? null
            : null,
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
        storedFileUrl: hit?.storedFileUrl ?? null,
        storedFileName: hit?.storedFileName ?? null,
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
