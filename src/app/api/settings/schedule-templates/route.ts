import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import ScheduleTemplateCatalogModel from "@/models/ScheduleTemplateCatalog";
import {
  buildDefaultScheduleTemplateRows,
  MAX_SCHEDULE_TEMPLATES,
  normalizeScheduleTemplateEntries,
  type ScheduleTemplateEntry,
} from "@/lib/scheduleTemplateTypes";

export const runtime = "nodejs";

const SETTINGS_KEY = "default";

export async function GET() {
  try {
    await connectDB();
    let doc = await ScheduleTemplateCatalogModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    if (!doc) {
      const seeded = buildDefaultScheduleTemplateRows();
      doc = await ScheduleTemplateCatalogModel.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { $set: { templates: seeded as ScheduleTemplateEntry[] } },
        { upsert: true, new: true, runValidators: true },
      )
        .lean()
        .exec();
    }
    const templates = normalizeScheduleTemplateEntries(doc?.templates);
    return NextResponse.json({
      templates,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load schedule templates." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const raw = (body as Record<string, unknown>).templates;
    let templates = normalizeScheduleTemplateEntries(raw);
    if (templates.length > MAX_SCHEDULE_TEMPLATES) {
      return NextResponse.json(
        {
          error: `At most ${MAX_SCHEDULE_TEMPLATES} template rows allowed.`,
        },
        { status: 400 },
      );
    }

    await connectDB();
    const doc = await ScheduleTemplateCatalogModel.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: { templates: templates as ScheduleTemplateEntry[] } },
      { upsert: true, new: true, runValidators: true },
    )
      .lean()
      .exec();
    templates = normalizeScheduleTemplateEntries(doc?.templates);
    return NextResponse.json({
      templates,
      updatedAt:
        doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save schedule templates." },
      { status: 500 },
    );
  }
}
