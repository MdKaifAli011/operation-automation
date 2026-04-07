import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import MeetLinkModel from "@/models/MeetLink";
import { getDemoTeacherFeedbackAfterMinutes } from "@/lib/demoFeedback/config";
import {
  getDemoAutoCompleteAfterMinutes,
  getTeacherBlockDurationMinutes,
} from "@/lib/demoSchedule/durations";
import { getMeetHoldDurationMinutes } from "@/lib/meetLinks/window";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    const docs = await MeetLinkModel.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return NextResponse.json({
      links: docs.map((d) => ({
        id: String(d._id),
        url: String(d.url ?? ""),
        label: String(d.label ?? ""),
        active: Boolean(d.active),
        sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
        updatedAt: d.updatedAt,
      })),
      holdDurationMinutes: getMeetHoldDurationMinutes(),
      teacherBlockMinutes: getTeacherBlockDurationMinutes(),
      demoAutoCompleteAfterMinutes: getDemoAutoCompleteAfterMinutes(),
      teacherFeedbackAfterMinutes: getDemoTeacherFeedbackAfterMinutes(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load Meet links." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: {
    url?: unknown;
    label?: unknown;
    active?: unknown;
    sortOrder?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json(
      { error: "A valid http(s) URL is required." },
      { status: 400 },
    );
  }
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const active = body.active !== false;
  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : 0;

  try {
    await connectDB();
    const doc = await MeetLinkModel.create({
      url,
      label,
      active,
      sortOrder,
    });
    return NextResponse.json(
      {
        id: String(doc._id),
        url: doc.url,
        label: doc.label ?? "",
        active: doc.active ?? true,
        sortOrder: doc.sortOrder ?? 0,
      },
      { status: 201 },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create Meet link." },
      { status: 500 },
    );
  }
}
