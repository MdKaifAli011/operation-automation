import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { serializeLead } from "@/lib/serializers";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

const ROW_TONES: Lead["rowTone"][] = [
  "interested",
  "not_interested",
  "followup_later",
  "new",
  "called_no_response",
];

const SHEET_TABS: Lead["sheetTab"][] = [
  "today",
  "ongoing",
  "followup",
  "not_interested",
  "converted",
];

function safeRowTone(v: unknown): Lead["rowTone"] {
  return typeof v === "string" && ROW_TONES.includes(v as Lead["rowTone"])
    ? (v as Lead["rowTone"])
    : "new";
}

function defaultSheetTab(
  rowTone: Lead["rowTone"],
  followUpDate: string | null,
): Lead["sheetTab"] {
  if (rowTone === "not_interested") return "not_interested";
  if (followUpDate) return "followup";
  if (rowTone === "new") return "today";
  return "ongoing";
}

function safeSheetTab(
  v: unknown,
  rowTone: Lead["rowTone"],
  followUpDate: string | null,
): Lead["sheetTab"] {
  if (typeof v !== "string" || !SHEET_TABS.includes(v as Lead["sheetTab"])) {
    return defaultSheetTab(rowTone, followUpDate);
  }
  const explicit = v as Lead["sheetTab"];
  if (rowTone === "new" && explicit === "ongoing") return "today";
  return explicit;
}

/** Import rows: same shape as a Lead without id — empty/missing cells use defaults (never drop a row). */
function normalizeImportRow(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const studentName =
    typeof row.studentName === "string" ? row.studentName.trim() : "";
  const phone =
    typeof row.phone === "string" ? row.phone.replace(/\s+/g, "") : "";

  const targetExams = Array.isArray(row.targetExams)
    ? row.targetExams
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const rawDataType =
    typeof row.dataType === "string" ? row.dataType.trim() : "";
  const rawGrade = typeof row.grade === "string" ? row.grade.trim() : "";

  const followUpDate =
    row.followUpDate === null || row.followUpDate === ""
      ? null
      : typeof row.followUpDate === "string"
        ? row.followUpDate
        : null;
  const rowTone = safeRowTone(row.rowTone);
  return {
    date:
      typeof row.date === "string" && row.date.length >= 8
        ? row.date
        : new Date().toISOString().slice(0, 10),
    followUpDate,
    studentName: studentName || "Unknown",
    parentName:
      typeof row.parentName === "string" ? row.parentName.trim() : "",
    dataType: rawDataType || "Organic",
    grade: rawGrade || "12th",
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
    rowTone,
    sheetTab: safeSheetTab(row.sheetTab, rowTone, followUpDate),
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
        {
          error:
            "No valid rows to save. Each row needs at least student name and phone. If you fixed the file, try again.",
        },
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
    const msg =
      e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : "Batch import failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
