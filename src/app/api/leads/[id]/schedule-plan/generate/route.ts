import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { mergePipelineMeta } from "@/lib/pipeline";
import { buildSchedulePlanPdfBytes } from "@/lib/schedulePlanPdf";
import { generateUniqueFilename } from "@/lib/pdfFilenameUtils";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }
    await connectDB();
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const meta = (lead.pipelineMeta ?? {}) as Record<string, unknown>;
    const schedule = (meta.schedule ?? {}) as Record<string, unknown>;

    const programmeOverview =
      schedule.programmeOverview &&
      typeof schedule.programmeOverview === "object" &&
      !Array.isArray(schedule.programmeOverview)
        ? (schedule.programmeOverview as {
            commencementIsoDate?: string | null;
            programmeName?: string;
            startDateLabel?: string;
            durationLabel?: string;
            targetExamLabel?: string;
          })
        : {};
    const weeklyRows = Array.isArray(schedule.weeklySessionStructure)
      ? (schedule.weeklySessionStructure as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id ?? "").trim(),
          sessionLabel: String(r.sessionLabel ?? "").trim(),
          day: String(r.day ?? "").trim(),
          timeIST: String(r.timeIST ?? "").trim(),
          subject: String(r.subject ?? "").trim(),
          sessionDuration: String(r.sessionDuration ?? "").trim(),
          sortOrder: Number(r.sortOrder ?? 0) || 0,
        }))
      : [];
    const milestones = Array.isArray(schedule.milestones)
      ? (schedule.milestones as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id ?? "").trim(),
          targetDateLabel: String(r.targetDateLabel ?? "").trim(),
          milestone: String(r.milestone ?? "").trim(),
          description: String(r.description ?? "").trim(),
          sortOrder: Number(r.sortOrder ?? 0) || 0,
        }))
      : [];
    const guidelinesRaw =
      schedule.guidelines && typeof schedule.guidelines === "object" && !Array.isArray(schedule.guidelines)
        ? (schedule.guidelines as Record<string, unknown>)
        : {};
    const guidelines = {
      generalGuidelines: Array.isArray(guidelinesRaw.generalGuidelines)
        ? guidelinesRaw.generalGuidelines.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [],
      mockTestsRevision: Array.isArray(guidelinesRaw.mockTestsRevision)
        ? guidelinesRaw.mockTestsRevision.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [],
    };
    if (
      !String(programmeOverview.programmeName ?? "").trim() ||
      !String(programmeOverview.startDateLabel ?? "").trim()
    ) {
      return NextResponse.json(
        { error: "Schedule is incomplete. Save commencement date first." },
        { status: 400 },
      );
    }

    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoPngBytes = await readFile(logoPath).catch(() => null);
    const pdfBytes = await buildSchedulePlanPdfBytes({
      studentName: String(lead.studentName ?? "Student").trim() || "Student",
      programmeOverview,
      weeklyRows,
      milestones,
      guidelines,
      logoPngBytes: logoPngBytes ? new Uint8Array(logoPngBytes) : null,
    });

    // Sanitize student name for filename
    const rawStudentName = String(lead.studentName ?? "Student").trim() || "Student";
    const safeStudentName = rawStudentName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    const baseName = `Weekly-session-plan-${safeStudentName}`;
    const dir = path.join(process.cwd(), "public", "uploads", "schedule-plans", id);
    await mkdir(dir, { recursive: true });
    const safeName = await generateUniqueFilename(dir, baseName, "pdf");
    const fullPath = path.join(dir, safeName);
    await writeFile(fullPath, Buffer.from(pdfBytes));
    const pdfUrl = `/uploads/schedule-plans/${id}/${safeName}`;
    const generatedAt = new Date().toISOString();
    const fileName = `Weekly session plan — ${rawStudentName}.pdf`;

    const merged = mergePipelineMeta(meta as never, {
      schedule: {
        pdfUrl,
        pdfFileName: fileName,
        pdfGeneratedAt: generatedAt,
      },
    });

    await LeadModel.findByIdAndUpdate(
      id,
      {
        $set: {
          pipelineMeta: merged,
        },
      },
      { runValidators: true },
    );

    return NextResponse.json({ pdfUrl, fileName, generatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not generate schedule PDF." },
      { status: 500 },
    );
  }
}

