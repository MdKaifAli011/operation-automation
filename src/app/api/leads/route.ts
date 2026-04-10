import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { serializeLead } from "@/lib/serializers";
import type { Lead } from "@/lib/types";

export const runtime = "nodejs";

function parseCreateBody(body: unknown): Partial<Lead> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const studentName =
    typeof b.studentName === "string" ? b.studentName.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.replace(/\s+/g, "") : "";
  const targetExams = Array.isArray(b.targetExams)
    ? b.targetExams.filter((x): x is string => typeof x === "string")
    : [];
  return {
    date:
      typeof b.date === "string" && b.date.length >= 8
        ? b.date
        : new Date().toISOString().slice(0, 10),
    followUpDate:
      b.followUpDate === null || b.followUpDate === ""
        ? null
        : typeof b.followUpDate === "string"
          ? b.followUpDate
          : null,
    studentName: studentName || "Unknown",
    parentName:
      typeof b.parentName === "string" ? b.parentName.trim() : "",
    dataType:
      typeof b.dataType === "string" && b.dataType.trim()
        ? b.dataType.trim()
        : "Organic",
    grade:
      typeof b.grade === "string" && b.grade.trim() ? b.grade.trim() : "12th",
    targetExams,
    country:
      typeof b.country === "string" && b.country.trim()
        ? b.country.trim()
        : "India",
    phone,
    email:
      typeof b.email === "string" && b.email.trim() ? b.email.trim() : "",
    pipelineSteps:
      typeof b.pipelineSteps === "number" &&
      b.pipelineSteps >= 0 &&
      b.pipelineSteps <= 4
        ? b.pipelineSteps
        : 0,
    rowTone:
      typeof b.rowTone === "string"
        ? (b.rowTone as Lead["rowTone"])
        : "new",
    sheetTab:
      typeof b.sheetTab === "string" && (b.sheetTab as string).trim()
        ? (b.sheetTab as Lead["sheetTab"])
        : undefined,
  };
}

function finalizeCreateBody(parsed: Partial<Lead>): Partial<Lead> {
  const rowTone = parsed.rowTone ?? "new";
  const followUpDate = parsed.followUpDate ?? null;
  const explicitTab = parsed.sheetTab;
  let sheetTab: Lead["sheetTab"];
  if (rowTone === "not_interested") {
    sheetTab = "not_interested";
  } else if (followUpDate) {
    sheetTab = "followup";
  } else if (rowTone === "new") {
    /** Always intake to Today's Data — do not allow `ongoing` + New from the API. */
    sheetTab = "today";
  } else if (
    explicitTab &&
    [
      "today",
      "ongoing",
      "followup",
      "not_interested",
      "converted",
    ].includes(explicitTab)
  ) {
    sheetTab = explicitTab;
  } else {
    sheetTab = "ongoing";
  }
  return { ...parsed, rowTone, sheetTab };
}

export async function GET() {
  try {
    await connectDB();
    const docs = await LeadModel.find({}).sort({ date: -1 }).lean();
    return NextResponse.json(
      docs.map((d) => serializeLead(d as Parameters<typeof serializeLead>[0])),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load leads. Check MONGODB_URI and that MongoDB is running." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const body = await req.json();
    const parsed = parseCreateBody(body);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }
    const doc = await LeadModel.create(finalizeCreateBody(parsed));
    return NextResponse.json(
      serializeLead(doc.toObject() as Parameters<typeof serializeLead>[0]),
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create lead." },
      { status: 400 },
    );
  }
}
