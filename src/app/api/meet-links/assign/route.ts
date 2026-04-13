import { NextResponse } from "next/server";
import { assignMeetLinkForDemoRow } from "@/lib/meetLinks/assignMeetLink";
import { sendDemoInviteMailSafe } from "@/lib/email/sendDemoInviteMail";
import { isDemoAutoSendInviteEnabled } from "@/lib/email/enrollmentRecipients";

export const runtime = "nodejs";

type Body = {
  leadId?: unknown;
  meetRowId?: unknown;
  isoDate?: unknown;
  timeHmIST?: unknown;
  subject?: unknown;
  durationMinutes?: unknown;
  teacher?: unknown;
  teacherBlockMinutes?: unknown;
  confirmSharedTeacherSlot?: unknown;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const leadId = typeof body.leadId === "string" ? body.leadId.trim() : "";
  const meetRowId = typeof body.meetRowId === "string" ? body.meetRowId.trim() : "";
  const isoDate = typeof body.isoDate === "string" ? body.isoDate.trim() : "";
  const timeHmIST = typeof body.timeHmIST === "string" ? body.timeHmIST.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const teacher = typeof body.teacher === "string" ? body.teacher.trim() : "";

  let durationMinutes: number | undefined;
  if (typeof body.durationMinutes === "number" && Number.isFinite(body.durationMinutes)) {
    durationMinutes = Math.max(1, Math.min(24 * 60, Math.round(body.durationMinutes)));
  }
  let teacherBlockMinutes: number | undefined;
  if (typeof body.teacherBlockMinutes === "number" && Number.isFinite(body.teacherBlockMinutes)) {
    teacherBlockMinutes = Math.max(15, Math.min(24 * 60, Math.round(body.teacherBlockMinutes)));
  }
  const confirmSharedTeacherSlot = body.confirmSharedTeacherSlot === true;

  if (!leadId || !meetRowId || !isoDate || !timeHmIST) {
    return NextResponse.json(
      { error: "leadId, meetRowId, isoDate, and timeHmIST are required." },
      { status: 400 },
    );
  }

  if (!teacher) {
    return NextResponse.json(
      { error: "teacher is required to check availability and reserve the slot.", code: "bad_request" },
      { status: 400 },
    );
  }

  const result = await assignMeetLinkForDemoRow({
    leadId,
    meetRowId,
    isoDate,
    timeHmIST,
    subject,
    durationMinutes,
    teacher,
    teacherBlockMinutes,
    confirmSharedTeacherSlot,
  });

  if ("error" in result) {
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "all_busy" ||
            result.code === "no_links" ||
            result.code === "teacher_busy" ||
            result.code === "teacher_busy_joinable" ||
            result.code === "shared_slot_missing"
          ? 409
          : 400;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  let demoInviteEmail:
    | { sent: boolean; skippedReason?: string; error?: string }
    | undefined;
  if (isDemoAutoSendInviteEnabled()) {
    const invite = await sendDemoInviteMailSafe({
      leadId,
      meetRowId,
      meetLinkUrlOverride: result.meetLinkUrl,
      persistInviteOnLead: true,
      assignSnapshot: {
        teacher,
        subject,
        isoDate,
        timeHmIST,
      },
    });
    demoInviteEmail = {
      sent: invite.sent,
      skippedReason: invite.skippedReason,
      error: invite.error,
    };
  }

  return NextResponse.json({ ...result, demoInviteEmail });
}
