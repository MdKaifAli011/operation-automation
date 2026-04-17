import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import EmailTemplateModel from "@/models/EmailTemplate";
import { ensureDefaultTemplates } from "@/lib/email/ensureDefaultTemplates";
import { buildLeadEmailVars } from "@/lib/email/buildLeadEmailVars";
import { renderTemplate } from "@/lib/email/renderTemplate";
import { sendMail, isMailConfigured } from "@/lib/email/sendMail";
import { demoInviteSummaryLine } from "@/lib/email/demoInviteSummary";
import { mergePipelineMeta, appendActivity } from "@/lib/pipeline";
import type { PipelineActivity } from "@/lib/types";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import { logDemoInviteEmail } from "@/lib/email/demoInviteLog";
import { resolveTeacherEmailFromFacultyName } from "@/lib/faculty/resolveTeacherEmail";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";

function buildFacultyDemoInviteHtml(vars: Record<string, string>): string {
  const studentName = vars.studentName || "Student";
  const subject = vars.subject || "—";
  const facultyName = vars.facultyName || "—";
  const sessionDate = vars.sessionDate || "—";
  const sessionTime = vars.sessionTime || "—";
  const duration = vars.duration || "—";
  const sessionLink = vars.sessionLink || vars.meetLink || "";
  const logoUrl = vars.logoUrl || "/logo.png";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Faculty Demo Session Brief</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:36px auto;padding:0 16px 40px;">
    <div style="text-align:center;font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">Academic Enrolments · Faculty Session Brief</div>
    <div style="background:#0f2a4a;border-radius:14px 14px 0 0;padding:16px 24px;border-bottom:3px solid #1e6bbf;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td valign="middle" style="padding-right:20px;">
            <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:7px 16px;border:1px solid #e2e8f0;">
              <img src="${logoUrl}" alt="Logo" style="height:28px;width:auto;display:block;" />
            </div>
          </td>
          <td valign="middle" align="right">
            <div style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:50px;padding:5px 14px;font-size:11px;font-weight:500;letter-spacing:.8px;color:#93c5fd;white-space:nowrap;">
              <span style="width:6px;height:6px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:7px;vertical-align:middle;"></span>
              <span style="vertical-align:middle;">Faculty Notified</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#ffffff;padding:36px 40px 32px;">
      <p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">${facultyName}</strong>,</p>
      <div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
      <p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">A demo session is scheduled for <strong style="color:#1e293b;">${studentName}</strong>. Please find all session details below.</p>
      <div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:22px 26px;margin:24px 0;">
        <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:16px;">Session Details</div>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;width:170px;">👨‍🎓 Student</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">${studentName}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">📅 Date</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">${sessionDate}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">🕗 Time</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">${sessionTime} IST</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">📘 Subject</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">${subject}</td></tr>
          <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">⏱ Duration</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">${duration}</td></tr>
          <tr><td style="padding:9px 0;font-size:13.5px;color:#64748b;">🔗 Session Link</td><td style="padding:9px 0;font-size:13.5px;font-weight:600;"><a href="${sessionLink}" style="color:#2563eb;text-decoration:none;border-bottom:1px dashed #93c5fd;">Click here to join →</a></td></tr>
        </table>
      </div>
      <div style="text-align:center;margin:26px 0 6px;">
        <a href="${sessionLink}" style="display:inline-block;background:#0f2a4a;color:#ffffff !important;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.4px;padding:14px 44px;border-radius:8px;box-shadow:0 4px 14px rgba(15,42,74,0.22);">Join Session Now</a>
      </div>
      <p style="text-align:center;font-size:11.5px;color:#94a3b8;margin:9px 0 0;">Please join 5-10 minutes before session start.</p>
      <div style="margin-top:14px;">
        <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
      </div>
    </div>
    <div style="background:#0f2a4a;border-radius:0 0 14px 14px;padding:24px 24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td valign="top" style="padding:0 20px 16px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:5px 12px;margin-bottom:8px;border:1px solid #e2e8f0;"><img src="${logoUrl}" alt="Logo" style="height:22px;width:auto;display:block;" /></div>
            <div style="font-size:11px;color:#64748b;line-height:1.6;">Empowering students to achieve<br/>their medical aspirations.</div>
          </td>
          <td valign="top" align="right" style="padding:0 0 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#3b82f6;margin-bottom:10px;">Contact Us</div>
            <div style="font-size:12.5px;color:#93c5fd;line-height:1.7;">
              <div style="margin-bottom:2px;">enrolments@testprepkart.com</div>
              <div style="margin-bottom:2px;">+91 8800 123 492</div>
              <div>www.testprepkart.com</div>
            </div>
          </td>
        </tr>
        <tr>
          <td valign="middle" style="padding-top:14px;font-size:11px;color:#475569;">
            <span style="vertical-align:middle;">© 2025</span>
            <img src="${logoUrl}" alt="Logo" style="height:13px;width:auto;display:inline-block;vertical-align:middle;margin:0 7px;" />
            <span style="vertical-align:middle;">All rights reserved.</span>
          </td>
          <td valign="middle" align="right" style="padding-top:14px;">
            <a href="#" style="font-size:11px;color:#64748b;text-decoration:none;margin-right:16px;">Privacy Policy</a>
            <a href="#" style="font-size:11px;color:#64748b;text-decoration:none;">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends the demo_invite template only to parent/student email.
 * Faculty invite must be sent as a separate email flow.
 * Optionally persists invite flags on the lead (used after Meet assign).
 */
export async function sendDemoInviteMail(opts: {
  leadId: string;
  meetRowId: string;
  /** When the lead document may not yet include the new Meet URL (e.g. immediately after assign). */
  meetLinkUrlOverride?: string;
  /** When true, sets inviteSent / activity on the lead document (used after Meet assign). */
  persistInviteOnLead?: boolean;
  /**
   * When the demo row is not in MongoDB yet (save lag), pass the slot from Meet assign so email can still send.
   */
  assignSnapshot?: {
    teacher: string;
    subject: string;
    isoDate: string;
    timeHmIST: string;
  };
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const { leadId, meetRowId, meetLinkUrlOverride, persistInviteOnLead, assignSnapshot } =
    opts;
  if (!mongoose.Types.ObjectId.isValid(leadId) || !meetRowId?.trim()) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "invalid_ids",
    });
    return { sent: false, skippedReason: "Invalid lead or demo row." };
  }

  await connectDB();
  await ensureDefaultTemplates();

  if (!isMailConfigured()) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "mail_not_configured",
    });
    return { sent: false, skippedReason: "Email is not configured (SMTP / MAIL)." };
  }

  const lead = await LeadModel.findById(leadId).lean();
  if (!lead) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "lead_not_found",
    });
    return { sent: false, skippedReason: "Lead not found." };
  }

  const to = typeof lead.email === "string" ? lead.email.trim() : "";
  if (!to) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "lead_no_email",
    });
    return { sent: false, skippedReason: "Lead has no email address." };
  }

  const tmpl = await EmailTemplateModel.findOne({ key: "demo_invite" }).lean();
  if (!tmpl) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "template_missing",
    });
    return { sent: false, skippedReason: "Demo invite template is missing." };
  }
  if (tmpl.enabled === false) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "template_disabled",
    });
    return { sent: false, skippedReason: "Demo invite template is disabled." };
  }

  const meta = (lead.pipelineMeta ?? {}) as Record<string, unknown>;
  const demo = meta.demo as { rows?: unknown[] } | undefined;
  const rows = Array.isArray(demo?.rows) ? [...(demo!.rows as DemoTableRowPersisted[])] : [];
  let idx = rows.findIndex((r) => String(r.meetRowId ?? "").trim() === meetRowId.trim());

  if (idx === -1) {
    const linkEarly = typeof meetLinkUrlOverride === "string" ? meetLinkUrlOverride.trim() : "";
    if (linkEarly && assignSnapshot?.teacher?.trim() && assignSnapshot.isoDate?.trim()) {
      logDemoInviteEmail({
        leadId,
        meetRowId,
        event: "assign_result",
        detail: "using_assign_snapshot_row",
        extra: { isoDate: assignSnapshot.isoDate, timeHmIST: assignSnapshot.timeHmIST },
      });
      const synthetic: DemoTableRowPersisted = {
        subject: String(assignSnapshot.subject ?? "").trim() || "Demo",
        teacher: String(assignSnapshot.teacher ?? "").trim(),
        studentTimeZone: "Asia/Kolkata",
        status: "Scheduled",
        isoDate: assignSnapshot.isoDate.trim(),
        timeHmIST: String(assignSnapshot.timeHmIST ?? "").trim(),
        meetRowId: meetRowId.trim(),
        meetLinkUrl: linkEarly,
        meetBookingId: "",
        meetWindowStartIso: "",
        meetWindowEndIso: "",
      };
      rows.push(synthetic);
      idx = rows.length - 1;
    } else {
      logDemoInviteEmail({
        leadId,
        meetRowId,
        event: "skip",
        detail: "demo_row_not_found_no_snapshot",
        extra: { hasOverride: Boolean(linkEarly) },
      });
      return { sent: false, skippedReason: "Demo row not found on this lead." };
    }
  }

  const row = { ...rows[idx] } as DemoTableRowPersisted;
  const link =
    typeof meetLinkUrlOverride === "string" && meetLinkUrlOverride.trim()
      ? meetLinkUrlOverride.trim()
      : String(row.meetLinkUrl ?? "").trim();
  if (!link) {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "no_meet_link",
    });
    return { sent: false, skippedReason: "No Meet link on this demo row yet." };
  }
  row.meetLinkUrl = link;
  rows[idx] = row;

  const syntheticLead = {
    ...lead,
    pipelineMeta: { ...meta, demo: { ...((demo as object) ?? {}), rows } },
  };

  const demoRowIndex = idx;
  const vars = buildLeadEmailVars(syntheticLead, "demo_invite", { demoRowIndex });
  const subject = renderTemplate(String(tmpl.subject), vars);
  const html = renderTemplate(String(tmpl.bodyHtml), vars);

  const toNorm = to.trim();
  const bccList = getEnrollmentTeamBccEmails();
  await sendMail({
    to: toNorm,
    subject,
    html,
  });
  if (bccList.length > 0) {
    const varsTeam = buildLeadEmailVars(syntheticLead, "demo_invite", {
      demoRowIndex,
      recipientType: "enrollment_team",
    });
    const subjectTeam = renderTemplate(String(tmpl.subject), varsTeam);
    const htmlTeam = renderTemplate(String(tmpl.bodyHtml), varsTeam);
    await sendMail({
      to: bccList.join(", "),
      subject: subjectTeam,
      html: htmlTeam,
    });
  }

  const teacherName = String(row.teacher ?? "").trim();
  const teacherEmail = teacherName
    ? await resolveTeacherEmailFromFacultyName(teacherName)
    : "";
  if (teacherEmail) {
    const facultySubject = `Faculty demo assigned - ${vars.studentName || "Student"} - ${vars.subject || "Demo"}`;
    const facultyHtml = buildFacultyDemoInviteHtml(vars);
    await sendMail({
      to: teacherEmail,
      subject: facultySubject,
      html: facultyHtml,
    });
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "sent",
      detail: "faculty_smtp_accepted",
      extra: {
        to: teacherEmail,
        cc: null,
        bcc: bccList.length > 0 ? bccList.join(", ") : null,
      },
    });
  } else {
    logDemoInviteEmail({
      leadId,
      meetRowId,
      event: "skip",
      detail: "faculty_email_missing",
      message: teacherName
        ? `Faculty email not found for teacher "${teacherName}".`
        : "Teacher name missing on demo row.",
    });
  }

  logDemoInviteEmail({
    leadId,
    meetRowId,
    event: "sent",
    detail: "smtp_accepted",
    extra: {
      to: toNorm,
      cc: null,
      bcc: bccList.length > 0 ? bccList.join(", ") : null,
      source: persistInviteOnLead ? "auto_assign" : "manual_send",
    },
  });

  if (persistInviteOnLead) {
    const at = new Date().toISOString();
    const summary = demoInviteSummaryLine(row);
    const doc = await LeadModel.findById(leadId);
    if (doc) {
      const merged = mergePipelineMeta(doc.pipelineMeta as never, {
        demo: {
          rows: rows.map((r, j) =>
            j === idx ? { ...r, inviteSent: true, inviteSentAt: at } : r,
          ),
          lastInviteSharedAt: at,
          lastInviteSummary: summary,
        },
      });
      doc.pipelineMeta = merged as typeof doc.pipelineMeta;
      doc.markModified("pipelineMeta");
      doc.activityLog = appendActivity(
        doc.activityLog as PipelineActivity[] | undefined,
        "demo",
        `Demo invite emailed to parent/student: ${summary}`,
      ) as unknown as typeof doc.activityLog;
      doc.markModified("activityLog");
      await doc.save();
    }
  }

  return { sent: true };
}

/** Wrap sendDemoInviteMail and log unexpected errors (e.g. SMTP failure). */
export async function sendDemoInviteMailSafe(
  opts: Parameters<typeof sendDemoInviteMail>[0],
): Promise<{ sent: boolean; skippedReason?: string; error?: string }> {
  try {
    return await sendDemoInviteMail(opts);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send_failed";
    logDemoInviteEmail({
      leadId: opts.leadId,
      meetRowId: opts.meetRowId,
      event: "error",
      detail: msg,
    });
    return { sent: false, error: msg };
  }
}
