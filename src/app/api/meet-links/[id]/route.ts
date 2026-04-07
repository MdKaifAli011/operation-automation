import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import MeetBookingModel from "@/models/MeetBooking";
import MeetLinkModel from "@/models/MeetLink";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: Ctx) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
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

  const patch: Record<string, unknown> = {};
  if (typeof body.url === "string") {
    const u = body.url.trim();
    if (u && !/^https?:\/\//i.test(u)) {
      return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
    }
    if (u) patch.url = u;
  }
  if (typeof body.label === "string") patch.label = body.label.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = body.sortOrder;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields." }, { status: 400 });
  }

  try {
    await connectDB();
    const doc = await MeetLinkModel.findByIdAndUpdate(id, { $set: patch }, {
      new: true,
    }).lean();
    if (!doc) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: String(doc._id),
      url: String(doc.url ?? ""),
      label: String(doc.label ?? ""),
      active: Boolean(doc.active),
      sortOrder: typeof doc.sortOrder === "number" ? doc.sortOrder : 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    await connectDB();
    const now = new Date();
    const future = await MeetBookingModel.exists({
      meetLinkId: new mongoose.Types.ObjectId(id),
      end: { $gt: now },
    });
    if (future) {
      return NextResponse.json(
        {
          error:
            "This link has upcoming demo bookings. Wait until they end or reassign demos before deleting.",
        },
        { status: 409 },
      );
    }
    await MeetBookingModel.deleteMany({
      meetLinkId: new mongoose.Types.ObjectId(id),
    });
    const res = await MeetLinkModel.findByIdAndDelete(id);
    if (!res) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
