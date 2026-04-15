import { randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { buildStudentReportPdfBytes } from "@/lib/studentReportPdf";
import { computePipelineStepsFromMeta, mergePipelineMeta } from "@/lib/pipeline";
import { serializeLead } from "@/lib/serializers";

export const runtime = "nodejs";

function uploadsPathForStudentReport(
  publicUrl: string,
  leadId: string,
): string | null {
  const prefix = `/uploads/student-reports/${leadId}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) {
    return null;
  }
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "student-reports",
    leadId,
    rest,
  );
}

async function removeOldReportFile(publicUrl: string, leadId: string) {
  const full = uploadsPathForStudentReport(publicUrl, leadId);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* gone */
  }
}

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }

    let body: {
      additionalNotes?: unknown;
      recommendations?: unknown;
      meetRowId?: unknown;
      manualQuestionsAttempted?: unknown;
      manualCorrectAnswers?: unknown;
      manualStudentLevel?: unknown;
    } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = {};
    }
    const additionalNotes =
      typeof body.additionalNotes === "string" ? body.additionalNotes : "";
    const recommendations =
      typeof body.recommendations === "string" ? body.recommendations : "";
    const meetRowId =
      typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
    const manualQuestionsAttempted =
      typeof body.manualQuestionsAttempted === "string"
        ? body.manualQuestionsAttempted.trim()
        : "";
    const manualCorrectAnswers =
      typeof body.manualCorrectAnswers === "string"
        ? body.manualCorrectAnswers.trim()
        : "";
    const manualStudentLevel =
      typeof body.manualStudentLevel === "string"
        ? body.manualStudentLevel.trim()
        : "";
    const usingManualFallback =
      !!manualQuestionsAttempted || !!manualCorrectAnswers || !!manualStudentLevel;
    if (usingManualFallback) {
      const attemptedN = Number.parseInt(manualQuestionsAttempted, 10);
      const correctN = Number.parseInt(manualCorrectAnswers, 10);
      if (!Number.isFinite(attemptedN) || attemptedN <= 0) {
        return NextResponse.json(
          { error: "Manual fallback requires a valid questions attempted value." },
          { status: 400 },
        );
      }
      if (!Number.isFinite(correctN) || correctN < 0 || correctN > attemptedN) {
        return NextResponse.json(
          {
            error:
              "Manual fallback requires valid correct answers (0 to attempted).",
          },
          { status: 400 },
        );
      }
      if (!manualStudentLevel) {
        return NextResponse.json(
          { error: "Manual fallback requires student level." },
          { status: 400 },
        );
      }
    }

    await connectDB();
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const meta = lead.pipelineMeta as Record<string, unknown> | undefined;
    const demo = meta?.demo as { rows?: unknown[] } | undefined;
    const rows = Array.isArray(demo?.rows) ? demo!.rows! : [];
    const selectedRows =
      meetRowId.length > 0
        ? rows.filter(
            (r) =>
              r &&
              typeof r === "object" &&
              !Array.isArray(r) &&
              String((r as { meetRowId?: string }).meetRowId ?? "").trim() ===
                meetRowId,
          )
        : rows;
    if (meetRowId && selectedRows.length === 0) {
      return NextResponse.json(
        { error: "Selected demo row was not found." },
        { status: 400 },
      );
    }
    if (!meetRowId && selectedRows.length === 0 && !usingManualFallback) {
      return NextResponse.json(
        {
          error:
            "No teacher feedback found. Use manual fallback inputs to generate this report.",
        },
        { status: 400 },
      );
    }

    const generatedAt = new Date().toISOString();
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoPngBytes = await readFile(logoPath).catch(() => null);

    const pdfBytes = await buildStudentReportPdfBytes({
      studentName:
        typeof lead.studentName === "string" ? lead.studentName : "Student",
      demoRows:
        selectedRows as Parameters<typeof buildStudentReportPdfBytes>[0]["demoRows"],
      additionalNotes,
      recommendations,
      manualQuestionsAttempted,
      manualCorrectAnswers,
      manualStudentLevel,
      reportSource: usingManualFallback ? "manual_sales" : "teacher_feedback",
      logoPngBytes: logoPngBytes ? new Uint8Array(logoPngBytes) : null,
      generatedAtIso: generatedAt,
    });

    const prevSr = meta?.studentReport as
      | { pdfUrl?: string | null }
      | undefined;
    const oldUrl =
      typeof prevSr?.pdfUrl === "string" ? prevSr.pdfUrl.trim() : "";
    if (oldUrl) {
      await removeOldReportFile(oldUrl, id);
    }

    const safeName = `${randomUUID()}.pdf`;
    const dir = path.join(process.cwd(), "public", "uploads", "student-reports", id);
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    await writeFile(fullPath, Buffer.from(pdfBytes));

    const pdfUrl = `/uploads/student-reports/${id}/${safeName}`;
    const fileName = `Progress report — ${String(lead.studentName || "Student").trim() || "Student"}.pdf`;
    const existingMeta =
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? { ...meta }
        : {};
    const merged = mergePipelineMeta(existingMeta as never, {
      studentReport: {
        pdfUrl,
        fileName,
        generatedAt,
        source: usingManualFallback ? "manual_sales" : "teacher_feedback",
        additionalNotes,
        recommendations,
        manualQuestionsAttempted: usingManualFallback ? manualQuestionsAttempted : "",
        manualCorrectAnswers: usingManualFallback ? manualCorrectAnswers : "",
        manualStudentLevel: usingManualFallback ? manualStudentLevel : "",
        generatedForMeetRowId:
          usingManualFallback || !meetRowId ? null : meetRowId,
        sendConfirmedAt: null,
      },
    });
    const pipelineSteps = computePipelineStepsFromMeta(merged);

    const doc = await LeadModel.findByIdAndUpdate(
      id,
      {
        $set: {
          pipelineMeta: merged,
          pipelineSteps,
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      lead: serializeLead(doc as Parameters<typeof serializeLead>[0]),
      pdfUrl,
      fileName,
      generatedAt,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not generate report" },
      { status: 500 },
    );
  }
}
