import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import {
  DEFAULT_LEAD_SOURCE_OPTIONS,
  normalizeLeadSources,
} from "@/lib/leadSources";
import LeadSourceSettingsModel from "@/models/LeadSourceSettings";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await connectDB();
    const doc = await LeadSourceSettingsModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    const sources = normalizeLeadSources(doc?.sources);
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ sources, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load lead source settings." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const raw = body?.sources;
    const sources = normalizeLeadSources(raw);
    if (sources.length === 0) {
      return NextResponse.json(
        { error: "At least one lead source is required." },
        { status: 400 },
      );
    }
    await connectDB();
    const doc = await LeadSourceSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { sources } },
      { upsert: true, new: true },
    )
      .lean()
      .exec();
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ sources, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save lead source settings." },
      { status: 500 },
    );
  }
}

/** Dev / admin: restore code defaults in DB. */
export async function DELETE() {
  try {
    await connectDB();
    const sources = normalizeLeadSources(DEFAULT_LEAD_SOURCE_OPTIONS);
    const doc = await LeadSourceSettingsModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { sources } },
      { upsert: true, new: true },
    )
      .lean()
      .exec();
    const updatedAt =
      doc && "updatedAt" in doc && doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : null;
    return NextResponse.json({ sources, updatedAt });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not reset lead source settings." },
      { status: 500 },
    );
  }
}
