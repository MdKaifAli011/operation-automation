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
import { resolveTeacherEmailFromFacultyName } from "@/lib/faculty/resolveTeacherEmail";
import {
  isEmailTemplateKey,
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";

export const runtime = "nodejs";

type PostBody = {
  templateKey?: string;
  demoRowIndex?: number;
  /** Stable row id for demo_invite (preferred over demoRowIndex). */
  meetRowId?: string;
  /** Step 1: status change email — row snapshot so copy matches UI before debounced save. */
  demoStatusEmail?: {
    status: "Scheduled" | "Completed" | "Cancelled";
    row?: Record<string, unknown>;
    notifyParent?: boolean;
    notifyFaculty?: boolean;
  };
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
      let idx =
        typeof demoRowIndex === "number" && demoRowIndex >= 0
          ? demoRowIndex
          : 0;
      const wantMeet =
        typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
      if (wantMeet) {
        const found = list.findIndex(
          (r) =>
            typeof r === "object" &&
            r !== null &&
            String((r as { meetRowId?: string }).meetRowId ?? "").trim() ===
              wantMeet,
        );
        if (found >= 0) idx = found;
      }
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
        persistInviteOnLead: true,
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

    if (templateKey === "demo_status_update") {
      const dse = body.demoStatusEmail;
      if (!dse || typeof dse !== "object") {
        return NextResponse.json(
          {
            error:
              "demo_status_update requires demoStatusEmail: { status, row? }.",
          },
          { status: 400 },
        );
      }
      const st = dse.status;
      if (st !== "Scheduled" && st !== "Completed" && st !== "Cancelled") {
        return NextResponse.json({ error: "Invalid demo status." }, { status: 400 });
      }
      const notifyParent = dse.notifyParent !== false;
      const notifyFaculty = dse.notifyFaculty === true;
      if (!notifyParent && !notifyFaculty) {
        return NextResponse.json({ ok: true, skipped: "No recipients selected." });
      }
      const tmpl = await EmailTemplateModel.findOne({
        key: "demo_status_update",
      }).lean();
      if (!tmpl) {
        return NextResponse.json(
          {
            error:
              "Template demo_status_update not found. Open Email templates to seed or create it.",
          },
          { status: 404 },
        );
      }
      if (tmpl.enabled === false) {
        return NextResponse.json(
          {
            error:
              "The demo status update template is disabled. Enable it under Email Templates Management.",
          },
          { status: 400 },
        );
      }

      const meta = (lead.pipelineMeta ?? {}) as Record<string, unknown>;
      const demo = meta.demo as { rows?: unknown[] } | Record<string, unknown> | undefined;
      const list = Array.isArray(demo?.rows) ? [...(demo as { rows: unknown[] }).rows] : [];
      let idx =
        typeof demoRowIndex === "number" && demoRowIndex >= 0 ? demoRowIndex : 0;
      const wantMeet =
        typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
      if (wantMeet) {
        const found = list.findIndex(
          (row) =>
            typeof row === "object" &&
            row !== null &&
            String((row as { meetRowId?: string }).meetRowId ?? "").trim() ===
              wantMeet,
        );
        if (found >= 0) idx = found;
      }
      if (list.length === 0 || idx < 0 || idx >= list.length) {
        return NextResponse.json(
          { error: "Invalid demo row (use meetRowId or demoRowIndex)." },
          { status: 400 },
        );
      }
      const demoRowIndexResolved = idx;
      const snapshot =
        dse.row && typeof dse.row === "object" && !Array.isArray(dse.row)
          ? (dse.row as Record<string, unknown>)
          : {};
      const prevRow =
        list[demoRowIndexResolved] &&
        typeof list[demoRowIndexResolved] === "object" &&
        list[demoRowIndexResolved] !== null
          ? (list[demoRowIndexResolved] as Record<string, unknown>)
          : {};
      list[demoRowIndexResolved] = { ...prevRow, ...snapshot, status: st };

      const demoBucket =
        demo && typeof demo === "object" && !Array.isArray(demo)
          ? { ...demo, rows: list }
          : { rows: list };
      const mergedLead = {
        ...lead,
        pipelineMeta: { ...meta, demo: demoBucket },
      };

      const vars = buildLeadEmailVars(mergedLead, "demo_status_update", {
        demoRowIndex: demoRowIndexResolved,
      });
      const subject = renderTemplate(String(tmpl.subject), vars);
      const html = renderTemplate(String(tmpl.bodyHtml), vars);

      const teacherName = String(
        (list[demoRowIndexResolved] as { teacher?: string }).teacher ?? "",
      ).trim();
      const teacherEmail = teacherName
        ? await resolveTeacherEmailFromFacultyName(teacherName)
        : undefined;
      const parentTo = (
        (lead as { parentEmail?: string }).parentEmail ||
        (lead as { email?: string }).email ||
        ""
      )
        .toString()
        .trim();
      let sent = 0;
      if (notifyParent) {
        if (!parentTo) {
          return NextResponse.json(
            {
              error:
                "Parent/student email is missing for this lead. Add parent email id first.",
            },
            { status: 400 },
          );
        }
        await sendMail({ to: parentTo, subject, html });
        sent += 1;
      }
      if (notifyFaculty) {
        if (!teacherEmail) {
          return NextResponse.json(
            {
              error:
                "Faculty email is missing on the selected teacher record.",
            },
            { status: 400 },
          );
        }
        await sendMail({ to: teacherEmail, subject, html });
        sent += 1;
      }
      if (sent === 0) {
        return NextResponse.json({ ok: true, skipped: "No recipients sent." });
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

    const reportOnlyBrochureEmail =
      templateKey === "brochure" &&
      !!body.brochureEmail &&
      Array.isArray(body.brochureEmail.selectionKeys) &&
      body.brochureEmail.selectionKeys.length === 0 &&
      body.brochureEmail.includeStudentReportPdf === true;

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

    if (templateKey === "fees" || templateKey === "bank_details") {
      vars = await mergeFeeEmailVarsWithBankDetails(lead, vars);
    }

    let subject = renderTemplate(String(tmpl.subject), vars);
    let html = renderTemplate(String(tmpl.bodyHtml), vars);

    if (reportOnlyBrochureEmail) {
      const parentName = String(vars.parentName || "Parent").trim() || "Parent";
      const studentName = String(vars.studentName || "Student").trim() || "Student";
      const grade = String(vars.grade || "").trim();
      const exams = String(vars.targetExams || "").trim();
      subject = `Demo Session Report - ${studentName} | Testprepkart`;
      html = `<div style="max-width:640px;margin:0 auto;font-family:Arial,'Segoe UI',sans-serif;color:#1f2937;line-height:1.6;">
<p style="margin:0 0 14px;">Dear ${parentName},</p>
<p style="margin:0 0 14px;">Greetings from <strong>Testprepkart</strong>.</p>
<p style="margin:0 0 14px;">Please find the latest <strong>Demo Session Report</strong> for <strong>${studentName}</strong> attached below for your review.</p>
<div style="margin:0 0 14px;padding:12px 14px;border:1px solid #e5e7eb;background:#f8fafc;">
<p style="margin:0;font-size:13px;color:#475569;">
Student: <strong>${studentName}</strong>${grade ? ` &nbsp;|&nbsp; Grade: <strong>${grade}</strong>` : ""}${exams && exams !== "—" ? ` &nbsp;|&nbsp; Exam track: <strong>${exams}</strong>` : ""}
</p>
</div>
${vars.brochureBundleHtml ?? ""}
<p style="margin:14px 0 0;">If you need any clarification, please reply to this email and our team will assist you.</p>
<p style="margin:18px 0 0;">Warm regards,<br/><strong>Testprepkart Team</strong></p>
</div>`;
    }

    if (templateKey === "brochure") {
      html = ensureBrochureBundleHtmlInRenderedHtml(
        String(tmpl.bodyHtml),
        html,
        vars.brochureBundleHtml ?? "",
      );
      const bccList = getEnrollmentTeamBccEmails();
      const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
      await sendMail({ to: toNorm, subject, html, bcc });
    } else if (templateKey === "fees" || templateKey === "bank_details") {
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
