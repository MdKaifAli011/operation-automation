import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { format, parseISO } from "date-fns";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { buildFeePlanPdfBytes } from "@/lib/feePlanPdf";
import {
  applyGstToLine,
  buildFeePreviewLines,
  formatUsd,
  inrToUsd,
} from "@/lib/feeStepComputations";
import { DEFAULT_INSTITUTE } from "@/lib/instituteProfileTypes";
import { mergePipelineMeta } from "@/lib/pipeline";
import InstituteProfileSettingsModel from "@/models/InstituteProfileSettings";
import LeadModel from "@/models/Lead";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

function uploadsPathForFeePlan(publicUrl: string, leadId: string): string | null {
  const prefix = `/uploads/fee-plans/${leadId}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) {
    return null;
  }
  return path.join(process.cwd(), "public", "uploads", "fee-plans", leadId, rest);
}

async function removeOldFeePlanFile(publicUrl: string, leadId: string) {
  const full = uploadsPathForFeePlan(publicUrl, leadId);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* ignore */
  }
}

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
    const fees = (meta.fees ?? {}) as Record<string, unknown>;
    const installmentRows = Array.isArray(fees.installmentRows) ? fees.installmentRows : [];
    const finalFee =
      typeof fees.finalFee === "number" && Number.isFinite(fees.finalFee)
        ? Math.max(0, Math.round(fees.finalFee))
        : 0;
    const baseTotal =
      typeof fees.baseTotal === "number" && Number.isFinite(fees.baseTotal)
        ? Math.max(0, Math.round(fees.baseTotal))
        : finalFee;
    const scholarshipPct =
      typeof fees.scholarshipPct === "number" && Number.isFinite(fees.scholarshipPct)
        ? Math.max(0, Math.min(100, fees.scholarshipPct))
        : 0;
    const scholarshipAmount = Math.max(0, baseTotal - finalFee);
    const generatedAt = new Date().toISOString();
    const rawDue = String(fees.feeMasterDueDate ?? "").trim() || null;
    const rawCourse = String(fees.customCourseName ?? "").trim();
    const courseName = rawCourse || String(fees.catalogCourseId ?? "").trim();

    const instituteDoc = await InstituteProfileSettingsModel.findOne({
      key: "default",
    })
      .lean()
      .exec();
    const instituteRaw =
      instituteDoc && typeof instituteDoc === "object"
        ? (instituteDoc as { institute?: Record<string, unknown> }).institute
        : undefined;
    const inrPerUsd =
      typeof instituteRaw?.inrPerUsd === "number" && Number.isFinite(instituteRaw.inrPerUsd)
        ? instituteRaw.inrPerUsd
        : DEFAULT_INSTITUTE.inrPerUsd;
    const feeGstPercent =
      typeof instituteRaw?.feeGstPercent === "number" &&
      Number.isFinite(instituteRaw.feeGstPercent)
        ? instituteRaw.feeGstPercent
        : DEFAULT_INSTITUTE.feeGstPercent;

    const normalizedInstallments = installmentRows.map((r, i) => {
      const row = r as Record<string, unknown>;
      return {
        id: String(row.id ?? `inst-${i + 1}`).trim() || `inst-${i + 1}`,
        description: String(row.description ?? ""),
        amountInr:
          typeof row.amountInr === "number" && Number.isFinite(row.amountInr)
            ? Math.max(0, Math.round(row.amountInr))
            : 0,
        dueDate: String(row.dueDate ?? "").trim(),
      };
    });

    const previewLines = buildFeePreviewLines({
      installmentRows: normalizedInstallments,
      finalFeeInr: finalFee,
      feeMasterDueDate: rawDue ?? "",
      courseLabel: courseName,
    });
    const option3Lines = previewLines.map((line) =>
      applyGstToLine({ ...line }, feeGstPercent),
    );
    const fmtDue = (iso: string) => {
      const t = String(iso ?? "").trim();
      if (!t) return "-";
      try {
        return format(parseISO(t), "do MMMM yyyy");
      } catch {
        return t;
      }
    };
    const toPdfRows = (
      rows: typeof previewLines,
      showGstColumn: boolean,
    ) =>
      rows.map((row) => ({
        no: row.no,
        description: row.description,
        gstText: showGstColumn
          ? row.gstApplicable
            ? formatUsd(inrToUsd(row.gstAmountInr, inrPerUsd))
            : "No"
          : "No",
        totalUsdText: formatUsd(inrToUsd(row.totalInr, inrPerUsd)),
        dueDateText: fmtDue(row.dueDate),
      }));

    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoPngBytes = await readFile(logoPath).catch(() => null);

    const pdfBytes = await buildFeePlanPdfBytes({
      studentName: String(lead.studentName ?? "Student").trim() || "Student",
      targetExam: String(fees.targetExamValue ?? "").trim(),
      courseName,
      currency: String(fees.currency ?? "INR").trim() || "INR",
      scholarshipPct,
      baseTotal,
      scholarshipAmount,
      finalFee,
      dueDate: rawDue,
      installments: normalizedInstallments.map((r, i) => ({
        no: i + 1,
        amountInr: r.amountInr,
        dueDate: r.dueDate,
      })),
      generatedAtIso: generatedAt,
      option1Rows: toPdfRows(previewLines, false),
      option2Rows: toPdfRows(previewLines, false),
      option3Rows: toPdfRows(option3Lines, true),
      logoPngBytes: logoPngBytes ? new Uint8Array(logoPngBytes) : null,
    });

    const oldUrl =
      typeof fees.feePlanPdfUrl === "string" ? fees.feePlanPdfUrl.trim() : "";
    if (oldUrl) {
      await removeOldFeePlanFile(oldUrl, id);
    }

    // Sanitize student name for filename
    const rawStudentName = String(lead.studentName ?? "Student").trim() || "Student";
    const safeStudentName = rawStudentName
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    const safeName = `Fee-plan-${safeStudentName}.pdf`;
    const dir = path.join(process.cwd(), "public", "uploads", "fee-plans", id);
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    await writeFile(fullPath, Buffer.from(pdfBytes));
    const pdfUrl = `/uploads/fee-plans/${id}/${safeName}`;

    const merged = mergePipelineMeta(meta as never, {
      fees: {
        ...(meta.fees as object),
        feePlanPdfUrl: pdfUrl,
        feePlanPdfFileName: `Fee Plan — ${rawStudentName}.pdf`,
        feePlanPdfGeneratedAt: generatedAt,
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

    return NextResponse.json({
      pdfUrl,
      generatedAt,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not generate fee plan PDF" },
      { status: 500 },
    );
  }
}
