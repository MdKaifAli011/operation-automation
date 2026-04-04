import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { serializeLead } from "@/lib/serializers";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

/** Import rows: same shape as a Lead without id (dates/strings from CSV). */
function normalizeImportRow(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const studentName =
    typeof row.studentName === "string" ? row.studentName.trim() : "";
  const phone =
    typeof row.phone === "string" ? row.phone.replace(/\s+/g, "") : "";
  if (!studentName || !phone) return null;
  const targetExams = Array.isArray(row.targetExams)
    ? row.targetExams.filter((x): x is string => typeof x === "string")
    : [];
  if (targetExams.length === 0) return null;
  return {
    date:
      typeof row.date === "string" && row.date.length >= 8
        ? row.date
        : new Date().toISOString().slice(0, 10),
    followUpDate:
      row.followUpDate === null || row.followUpDate === ""
        ? null
        : typeof row.followUpDate === "string"
          ? row.followUpDate
          : null,
    studentName,
    parentName:
      typeof row.parentName === "string" && row.parentName.trim()
        ? row.parentName.trim()
        : "—",
    dataType: typeof row.dataType === "string" ? row.dataType : "Organic",
    grade: typeof row.grade === "string" ? row.grade : "12th",
    targetExams,
    country:
      typeof row.country === "string" && row.country.trim()
        ? row.country.trim()
        : "India",
    phone,
    email: typeof row.email === "string" ? row.email.trim() : "",
    pipelineSteps:
      typeof row.pipelineSteps === "number" &&
      row.pipelineSteps >= 0 &&
      row.pipelineSteps <= 4
        ? row.pipelineSteps
        : 0,
    rowTone:
      typeof row.rowTone === "string"
        ? (row.rowTone as Lead["rowTone"])
        : "new",
    sheetTab:
      typeof row.sheetTab === "string"
        ? (row.sheetTab as Lead["sheetTab"])
        : "ongoing",
  };
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const raw = body?.leads;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Body must include a non-empty leads array." },
        { status: 400 },
      );
    }
    if (raw.length > 500) {
      return NextResponse.json(
        { error: "Maximum 500 leads per batch." },
        { status: 400 },
      );
    }
    const payloads: Record<string, unknown>[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const n = normalizeImportRow(item as Record<string, unknown>);
      if (n) payloads.push(n);
    }
    if (payloads.length === 0) {
      return NextResponse.json(
        { error: "No valid leads in batch." },
        { status: 400 },
      );
    }
    const created = await LeadModel.insertMany(payloads, { ordered: false });
    return NextResponse.json(
      created.map((doc) =>
        serializeLead(doc.toObject() as Parameters<typeof serializeLead>[0]),
      ),
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Batch import failed." },
      { status: 400 },
    );
  }
}
