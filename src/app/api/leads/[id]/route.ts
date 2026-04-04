import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { serializeLead } from "@/lib/serializers";
export const runtime = "nodejs";

const PATCH_KEYS = new Set([
  "date",
  "followUpDate",
  "studentName",
  "parentName",
  "dataType",
  "grade",
  "targetExams",
  "country",
  "phone",
  "email",
  "pipelineSteps",
  "rowTone",
  "sheetTab",
]);

function buildPatch(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PATCH_KEYS) {
    if (!(key in b)) continue;
    const v = b[key];
    if (key === "followUpDate") {
      out[key] =
        v === null || v === "" ? null : typeof v === "string" ? v : undefined;
      if (out[key] === undefined) delete out[key];
      continue;
    }
    if (key === "targetExams") {
      if (Array.isArray(v))
        out[key] = v.filter((x): x is string => typeof x === "string");
      continue;
    }
    if (key === "pipelineSteps") {
      if (typeof v === "number" && v >= 0 && v <= 4) out[key] = v;
      continue;
    }
    if (
      key === "studentName" ||
      key === "parentName" ||
      key === "dataType" ||
      key === "grade" ||
      key === "country" ||
      key === "phone" ||
      key === "email" ||
      key === "date" ||
      key === "rowTone" ||
      key === "sheetTab"
    ) {
      if (typeof v === "string") {
        out[key] = key === "phone" ? v.replace(/\s+/g, "") : v.trim();
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await connectDB();
    const doc = await LeadModel.findById(id).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      serializeLead(doc as Parameters<typeof serializeLead>[0]),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const patch = buildPatch(body);
    if (!patch) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    await connectDB();
    const doc = await LeadModel.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    ).lean();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(
      serializeLead(doc as Parameters<typeof serializeLead>[0]),
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
