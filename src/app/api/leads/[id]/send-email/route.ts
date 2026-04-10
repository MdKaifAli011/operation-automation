import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import EmailTemplateModel from "@/models/EmailTemplate";
import { ensureDefaultTemplates } from "@/lib/email/ensureDefaultTemplates";
import { buildLeadEmailVars } from "@/lib/email/buildLeadEmailVars";
import { renderTemplate } from "@/lib/email/renderTemplate";
import { sendMail } from "@/lib/email/sendMail";
import {
  isEmailTemplateKey,
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";

export const runtime = "nodejs";

type PostBody = {
  templateKey?: string;
  demoRowIndex?: number;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const templateKeyRaw = body.templateKey;
  if (typeof templateKeyRaw !== "string" || !isEmailTemplateKey(templateKeyRaw)) {
    return NextResponse.json(
      { error: "Unknown or missing templateKey." },
      { status: 400 },
    );
  }
  const templateKey = templateKeyRaw as EmailTemplateKey;

  const demoRowIndex =
    typeof body.demoRowIndex === "number" && body.demoRowIndex >= 0
      ? body.demoRowIndex
      : undefined;

  try {
    await connectDB();
    await ensureDefaultTemplates();

    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const to = typeof lead.email === "string" ? lead.email.trim() : "";
    if (!to) {
      return NextResponse.json(
        { error: "This lead has no email address. Add one on the lead first." },
        { status: 400 },
      );
    }

    const tmpl = await EmailTemplateModel.findOne({ key: templateKey }).lean();
    if (!tmpl) {
      return NextResponse.json(
        {
          error:
            "Template not found. Open Email templates to create or restore templates.",
        },
        { status: 404 },
      );
    }
    if (tmpl.enabled === false) {
      return NextResponse.json(
        { error: "This template is disabled. Enable it under Email Templates Management." },
        { status: 400 },
      );
    }

    const vars = buildLeadEmailVars(lead, templateKey, { demoRowIndex });
    const subject = renderTemplate(String(tmpl.subject), vars);
    const html = renderTemplate(String(tmpl.bodyHtml), vars);

    await sendMail({ to, subject, html });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
