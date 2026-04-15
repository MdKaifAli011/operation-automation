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
  await sendMail({ to: toNorm, subject, html });

  logDemoInviteEmail({
    leadId,
    meetRowId,
    event: "sent",
    detail: "smtp_accepted",
    extra: {
      to: toNorm,
      cc: null,
      bcc: null,
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
