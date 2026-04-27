import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AllLeadModel from "@/models/AllLead";
import type { AllLeadDocument } from "@/models/AllLead";

export const runtime = "nodejs";

function parseCreateBody(body: unknown): Partial<AllLeadDocument> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const studentName =
    typeof b.studentName === "string" ? b.studentName.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.replace(/\s+/g, "") : "";
  const parentEmail =
    typeof b.parentEmail === "string" && b.parentEmail.trim()
      ? b.parentEmail.trim()
      : typeof b.email === "string" && b.email.trim()
        ? b.email.trim()
        : "";
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
    studentName: studentName || "Add Student Name",
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
    parentEmail,
    email: parentEmail,
    pipelineSteps:
      typeof b.pipelineSteps === "number" &&
      b.pipelineSteps >= 0 &&
      b.pipelineSteps <= 4
        ? b.pipelineSteps
        : 0,
    rowTone:
      typeof b.rowTone === "string"
        ? (b.rowTone as AllLeadDocument["rowTone"])
        : "new",
    sheetTab:
      typeof b.sheetTab === "string" && (b.sheetTab as string).trim()
        ? (b.sheetTab as AllLeadDocument["sheetTab"])
        : undefined,
  };
}

function finalizeCreateBody(parsed: Partial<AllLeadDocument>): Partial<AllLeadDocument> {
  const rowTone = parsed.rowTone ?? "new";
  const followUpDate = parsed.followUpDate ?? null;
  const explicitTab = parsed.sheetTab;
  let sheetTab: "today" | "old";
  if (rowTone === "not_interested") {
    sheetTab = "old";
  } else if (followUpDate) {
    sheetTab = "old";
  } else if (rowTone === "new") {
    sheetTab = "today";
  } else if (explicitTab && ["today", "old"].includes(explicitTab as string)) {
    sheetTab = explicitTab as "today" | "old";
  } else {
    sheetTab = "today";
  }
  return { ...parsed, rowTone, sheetTab };
}

function serializeAllLead(doc: AllLeadDocument) {
  return {
    id: doc._id.toString(),
    date: doc.date,
    followUpDate: doc.followUpDate,
    studentName: doc.studentName,
    parentName: doc.parentName,
    dataType: doc.dataType,
    grade: doc.grade,
    targetExams: doc.targetExams,
    country: doc.country,
    phone: doc.phone,
    parentEmail: doc.parentEmail,
    email: doc.email,
    pipelineSteps: doc.pipelineSteps,
    rowTone: doc.rowTone,
    sheetTab: doc.sheetTab,
    notInterestedRemark: doc.notInterestedRemark,
    emailStatus: doc.emailStatus || "not_sent",
    emailSentAt: doc.emailSentAt || null,
    emailError: doc.emailError || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function GET(req: Request) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const sortKey = searchParams.get("sortKey") || "date";
    const sortDir = searchParams.get("sortDir") || "desc";
    const search = searchParams.get("search") || "";

    const query: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      const dateQuery: Record<string, string> = {};
      if (dateFrom) dateQuery.$gte = dateFrom;
      if (dateTo) dateQuery.$lte = dateTo;
      query.date = dateQuery;
    }
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { country: { $regex: search, $options: "i" } },
      ];
    }

    const sort: Record<string, 1 | -1> = {};
    sort[sortKey] = sortDir === "asc" ? 1 : -1;

    const docs = await AllLeadModel.find(query).sort(sort).lean();
    return NextResponse.json(
      docs.map((d) => serializeAllLead(d as AllLeadDocument)),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load all leads. Check MONGODB_URI and that MongoDB is running." },
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
    const doc = await AllLeadModel.create(finalizeCreateBody(parsed));
    return NextResponse.json(
      serializeAllLead(doc.toObject() as AllLeadDocument),
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create all lead." },
      { status: 400 },
    );
  }
}
