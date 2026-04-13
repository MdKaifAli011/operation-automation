import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import EmailTemplateModel from "@/models/EmailTemplate";
import { ensureDefaultTemplates } from "@/lib/email/ensureDefaultTemplates";
import { buildLeadEmailVars } from "@/lib/email/buildLeadEmailVars";
import { buildBrochureBundleEmailVars } from "@/lib/email/buildBrochureBundleEmailVars";
import { renderTemplate } from "@/lib/email/renderTemplate";
import { sendMail } from "@/lib/email/sendMail";
import { sendDemoInviteMailSafe } from "@/lib/email/sendDemoInviteMail";
import { logDemoInviteEmail } from "@/lib/email/demoInviteLog";
import { mergeFeeEmailVarsWithBankDetails } from "@/lib/email/feeBankDetailsForEmail";
import {
  ensureBrochureBundleHtmlInRenderedHtml,
  ensureFeeBankDetailsInRenderedHtml,
} from "@/lib/email/templateRenderedEnsures";
import { sendFeesEnrollmentBundleEmail } from "@/lib/email/sendFeesEnrollmentBundle";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";
import { normalizeMailRecipients } from "@/lib/email/mailRecipients";
import {
  isEmailTemplateKey,
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";

export const runtime = "nodejs";

type PostBody = {
  templateKey?: string;
  demoRowIndex?: number;
  /** Step 2: which catalog brochures + optional PDF to include in one email. */
  brochureEmail?: {
    selectionKeys: string[];
    includeStudentReportPdf: boolean;
  };
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

    if (templateKey === "demo_invite") {
      const meta = (lead.pipelineMeta ?? {}) as Record<string, unknown>;
      const demo = meta.demo as { rows?: unknown[] } | undefined;
      const list = Array.isArray(demo?.rows) ? demo!.rows! : [];
      const idx =
        typeof demoRowIndex === "number" && demoRowIndex >= 0
          ? demoRowIndex
          : 0;
      const row = list[idx] as { meetRowId?: string } | undefined;
      const meetRowId = typeof row?.meetRowId === "string" ? row.meetRowId.trim() : "";
      if (!meetRowId) {
        return NextResponse.json(
          { error: "No demo row selected or this row is missing an id." },
          { status: 400 },
        );
      }
      const invite = await sendDemoInviteMailSafe({
        leadId: id,
        meetRowId,
        persistInviteOnLead: false,
      });
      if (!invite.sent) {
        logDemoInviteEmail({
          leadId: id,
          meetRowId,
          event: "skip",
          detail: "app_returned_failure",
          message:
            invite.error ??
            invite.skippedReason ??
            "The email could not be sent.",
        });
        return NextResponse.json(
          {
            error:
              invite.error ??
              invite.skippedReason ??
              "Could not send demo invite.",
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (templateKey === "fees_enrollment_bundle") {
      const to = typeof lead.email === "string" ? lead.email.trim() : "";
      if (!to) {
        return NextResponse.json(
          { error: "This lead has no email address. Add one on the lead first." },
          { status: 400 },
        );
      }
      const feesTmpl = await EmailTemplateModel.findOne({ key: "fees" }).lean();
      const enrollmentTmpl = await EmailTemplateModel.findOne({
        key: "enrollment",
      }).lean();
      if (!feesTmpl || !enrollmentTmpl) {
        return NextResponse.json(
          {
            error:
              "Fee or enrollment template is missing. Open Email templates to create or restore them.",
          },
          { status: 404 },
        );
      }
      if (feesTmpl.enabled === false || enrollmentTmpl.enabled === false) {
        return NextResponse.json(
          {
            error:
              "The fee or enrollment template is disabled. Enable both under Email templates.",
          },
          { status: 400 },
        );
      }
      await sendFeesEnrollmentBundleEmail({
        to,
        lead,
        feesTmpl,
        enrollmentTmpl,
      });
      return NextResponse.json({ ok: true });
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

    let vars: Record<string, string>;
    if (templateKey === "brochure") {
      if (!body.brochureEmail || typeof body.brochureEmail !== "object") {
        return NextResponse.json(
          {
            error:
              "Documents email requires brochureEmail: { selectionKeys, includeStudentReportPdf }. Use the Step 2 · Documents send buttons in the app.",
          },
          { status: 400 },
        );
      }
      const sel = body.brochureEmail.selectionKeys;
      const keys = Array.isArray(sel) ? sel.map((k) => String(k ?? "").trim()).filter(Boolean) : [];
      const includePdf = body.brochureEmail.includeStudentReportPdf === true;
      try {
        vars = await buildBrochureBundleEmailVars(lead, {
          selectionKeys: keys,
          includeStudentReportPdf: includePdf,
        });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Invalid brochure or report selection.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else {
      vars = buildLeadEmailVars(lead, templateKey, { demoRowIndex });
    }

    if (templateKey === "fees") {
      vars = await mergeFeeEmailVarsWithBankDetails(lead, vars);
    }

    const subject = renderTemplate(String(tmpl.subject), vars);
    let html = renderTemplate(String(tmpl.bodyHtml), vars);

    if (templateKey === "brochure") {
      html = ensureBrochureBundleHtmlInRenderedHtml(
        String(tmpl.bodyHtml),
        html,
        vars.brochureBundleHtml ?? "",
      );
      const bccList = getEnrollmentTeamBccEmails();
      const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
      await sendMail({ to: toNorm, subject, html, bcc });
    } else if (templateKey === "fees") {
      html = ensureFeeBankDetailsInRenderedHtml(
        String(tmpl.bodyHtml),
        html,
        vars.feeBankDetailsHtml ?? "",
      );
      const bccList = getEnrollmentTeamBccEmails();
      const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
      await sendMail({ to: toNorm, subject, html, bcc });
    } else {
      await sendMail({ to, subject, html });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
