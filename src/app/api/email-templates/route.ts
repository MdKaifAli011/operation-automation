import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import EmailTemplateModel from "@/models/EmailTemplate";
import { ensureDefaultTemplates } from "@/lib/email/ensureDefaultTemplates";
import { isEmailTemplateKey } from "@/lib/email/templateKeys";
import { isMailConfigured } from "@/lib/email/sendMail";
import { DEFAULT_EMAIL_TEMPLATES } from "@/lib/email/defaultEmailTemplates";

export const runtime = "nodejs";

export async function GET() {
  try {
    await connectDB();
    await ensureDefaultTemplates();
    const docs = await EmailTemplateModel.find({})
      .sort({ sortOrder: 1, key: 1 })
      .lean();
    return NextResponse.json({
      templates: docs.map((d) => ({
        key: d.key as string,
        name: d.name as string,
        description: (d.description as string) ?? "",
        subject: d.subject as string,
        bodyHtml: d.bodyHtml as string,
        enabled: Boolean(d.enabled),
        sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
        updatedAt: d.updatedAt,
      })),
      smtpConfigured: isMailConfigured(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not load email templates." },
      { status: 500 },
    );
  }
}

type PutBody = {
  restoreDefaults?: boolean;
  templates?: Array<{
    key: string;
    subject?: string;
    bodyHtml?: string;
    enabled?: boolean;
  }>;
};

export async function PUT(req: Request) {
  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const items = body.templates;
  if (!body.restoreDefaults && (!Array.isArray(items) || items.length === 0)) {
    return NextResponse.json(
      { error: "Expected templates array." },
      { status: 400 },
    );
  }
  try {
    await connectDB();
    await ensureDefaultTemplates();
    if (body.restoreDefaults) {
      for (const def of DEFAULT_EMAIL_TEMPLATES) {
        await EmailTemplateModel.updateOne(
          { key: def.key },
          {
            $set: {
              name: def.name,
              description: def.description,
              subject: def.subject,
              bodyHtml: def.bodyHtml,
              enabled: true,
              sortOrder: def.sortOrder,
            },
          },
          { upsert: true },
        );
      }
      const docs = await EmailTemplateModel.find({})
        .sort({ sortOrder: 1, key: 1 })
        .lean();
      return NextResponse.json({
        templates: docs.map((d) => ({
          key: d.key as string,
          name: d.name as string,
          description: (d.description as string) ?? "",
          subject: d.subject as string,
          bodyHtml: d.bodyHtml as string,
          enabled: Boolean(d.enabled),
          sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
          updatedAt: d.updatedAt,
        })),
        smtpConfigured: isMailConfigured(),
      });
    }
    const templateItems = Array.isArray(items) ? items : [];
    for (const row of templateItems) {
      if (!row || typeof row.key !== "string") continue;
      if (!isEmailTemplateKey(row.key)) continue;
      const key = row.key;
      const subject =
        typeof row.subject === "string" ? row.subject : undefined;
      const bodyHtml =
        typeof row.bodyHtml === "string" ? row.bodyHtml : undefined;
      const patch: Record<string, unknown> = {};
      if (subject !== undefined) patch.subject = subject;
      if (bodyHtml !== undefined) patch.bodyHtml = bodyHtml;
      if (typeof row.enabled === "boolean") patch.enabled = row.enabled;
      if (Object.keys(patch).length === 0) continue;
      await EmailTemplateModel.updateOne({ key }, { $set: patch });
    }
    const docs = await EmailTemplateModel.find({})
      .sort({ sortOrder: 1, key: 1 })
      .lean();
    return NextResponse.json({
      templates: docs.map((d) => ({
        key: d.key as string,
        name: d.name as string,
        description: (d.description as string) ?? "",
        subject: d.subject as string,
        bodyHtml: d.bodyHtml as string,
        enabled: Boolean(d.enabled),
        sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : 0,
        updatedAt: d.updatedAt,
      })),
      smtpConfigured: isMailConfigured(),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save email templates." },
      { status: 500 },
    );
  }
}
