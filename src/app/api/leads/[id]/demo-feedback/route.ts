import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import DemoTeacherFeedbackTokenModel from "@/models/DemoTeacherFeedbackToken";
import { sendMail } from "@/lib/email/sendMail";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";
import { normalizeMailRecipients } from "@/lib/email/mailRecipients";
import { resolveTeacherEmailFromFacultyName } from "@/lib/faculty/resolveTeacherEmail";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";
import { isTeacherFeedbackEligible } from "@/lib/demoFeedback/eligibility";
import { getDemoTeacherFeedbackAfterMinutes } from "@/lib/demoFeedback/config";
import { patchDemoRowTeacherFeedback } from "@/lib/demoFeedback/persistLeadRow";
import { format } from "date-fns";
import { parseISO } from "date-fns";

export const runtime = "nodejs";

type DemoRow = {
  meetRowId?: string;
  teacher?: string;
  subject?: string;
  isoDate?: string;
  timeHmIST?: string;
  status?: string;
  teacherFeedbackSubmittedAt?: string | null;
};

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  const { id } = await context.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid lead id." }, { status: 400 });
  }

  let body: { meetRowId?: unknown; sendEmail?: unknown; linkOnly?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const meetRowId = typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
  const sendEmail = body.sendEmail === true;
  const linkOnly = body.linkOnly === true;

  if (!meetRowId) {
    return NextResponse.json({ error: "meetRowId is required." }, { status: 400 });
  }

  if (!sendEmail && !linkOnly) {
    return NextResponse.json(
      {
        error:
          "Pass sendEmail: true to email the teacher, or linkOnly: true to get a shareable link without emailing.",
      },
      { status: 400 },
    );
  }
  if (sendEmail && linkOnly) {
    return NextResponse.json(
      { error: "Use only one of sendEmail or linkOnly." },
      { status: 400 },
    );
  }

  try {
    await connectDB();
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    const demo = (lead as { pipelineMeta?: { demo?: { rows?: DemoRow[] } } })
      .pipelineMeta?.demo;
    const rows = Array.isArray(demo?.rows) ? demo!.rows! : [];
    const row = rows.find((r) => String(r.meetRowId ?? "").trim() === meetRowId);
    if (!row) {
      return NextResponse.json({ error: "Demo row not found." }, { status: 404 });
    }

    const rowCancelled = String(row.status ?? "").trim() === "Cancelled";
    const rowSubmitted =
      row.teacherFeedbackSubmittedAt != null &&
      String(row.teacherFeedbackSubmittedAt).trim() !== "";

    if (rowCancelled) {
      return NextResponse.json(
        { error: "Feedback is not available for a cancelled demo.", code: "cancelled" },
        { status: 400 },
      );
    }
    if (rowSubmitted) {
      return NextResponse.json(
        { error: "Feedback was already submitted for this demo.", code: "submitted" },
        { status: 400 },
      );
    }

    if (sendEmail) {
      if (
        !isTeacherFeedbackEligible(row as Parameters<typeof isTeacherFeedbackEligible>[0])
      ) {
        const after = getDemoTeacherFeedbackAfterMinutes();
        return NextResponse.json(
          {
            error: `Feedback email can only be sent at least ${after} minutes after the demo start.`,
            code: "not_eligible",
          },
          { status: 400 },
        );
      }
    }

    let tokenDoc = await DemoTeacherFeedbackTokenModel.findOne({
      leadId: new mongoose.Types.ObjectId(id),
      meetRowId,
      submittedAt: null,
    }).lean();

    if (!tokenDoc) {
      const token = randomBytes(24).toString("hex");
      const created = await DemoTeacherFeedbackTokenModel.create({
        token,
        leadId: new mongoose.Types.ObjectId(id),
        meetRowId,
        teacherName: String(row.teacher ?? "").trim(),
      });
      tokenDoc = created.toObject();
    }

    const token = String(tokenDoc.token ?? "");
    const base = getAppBaseUrl();
    const feedbackUrl = `${base}/feedback/demo/${encodeURIComponent(token)}`;

    const studentName = String((lead as { studentName?: string }).studentName ?? "Student").trim();
    const teacherName = String(row.teacher ?? "").trim();
    const demoLine = `${row.subject ?? "Demo"} · ${row.isoDate ? format(parseISO(String(row.isoDate)), "d MMM yyyy") : ""} · ${row.timeHmIST ?? ""} IST`;

    if (linkOnly) {
      return NextResponse.json({
        ok: true,
        feedbackUrl,
        emailSent: false,
        emailSkippedReason: null as string | null,
      });
    }

    let emailSent = false;
    let emailSkippedReason: string | null = null;
    let feedbackInviteEnrollmentBcc = false;

    if (sendEmail) {
      const toRaw = await resolveTeacherEmailFromFacultyName(teacherName);
      const to = toRaw?.trim() ?? "";
      if (!to) {
        emailSkippedReason =
          "No email found for this teacher on the Faculties record. You can still copy the link below.";
      } else {
        const bccList = getEnrollmentTeamBccEmails();
        feedbackInviteEnrollmentBcc = bccList.length > 0;
        const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
        const subject = `Demo feedback — ${studentName}`;
        const html = `<p>Hello ${teacherName.split(" ")[0] || teacherName},</p>
<p>Please share brief feedback for your <strong>trial class</strong> with <strong>${studentName}</strong>.</p>
<p style="margin:12px 0;color:#424242;font-size:14px;">${demoLine}</p>
<p><a href="${feedbackUrl}" style="display:inline-block;background:#1565c0;color:#fff;padding:10px 16px;text-decoration:none;font-weight:600;">Open feedback form</a></p>
<p><small>This link works until you submit the form once. After submission it cannot be used again.</small></p>
<p><small>If the button does not work, paste this URL into your browser:<br/>${feedbackUrl}</small></p>
<p>Thank you,<br/>Team</p>`;
        await sendMail({ to: toNorm, subject, html, bcc });
        emailSent = true;
      }
    }

    const at = new Date().toISOString();
    await patchDemoRowTeacherFeedback(
      id,
      meetRowId,
      { teacherFeedbackInviteSentAt: at },
      {
        kind: "demo",
        message: emailSent
          ? `Teacher feedback link emailed to ${teacherName}${feedbackInviteEnrollmentBcc ? " (enrollment BCC)" : ""} for ${demoLine}`
          : `Teacher feedback link created for ${teacherName} (${demoLine})`,
      },
    );

    return NextResponse.json({
      ok: true,
      feedbackUrl,
      emailSent,
      emailSkippedReason,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
