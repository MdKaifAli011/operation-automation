import { sendMail, isMailConfigured } from "@/lib/email/sendMail";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";

/**
 * Notifies ENROLLMENT_TEAM_BCC when a teacher submits demo feedback (public form).
 * No-op if mail is not configured or no enrollment addresses are set.
 */
export async function notifyEnrollmentTeacherFeedbackSubmitted(opts: {
  leadId: string;
  studentName: string;
  teacherName: string;
  demoSummary: string;
  ratingLabel: string;
  trackLabel: string;
  recommendedNextLabel: string;
}): Promise<void> {
  if (!isMailConfigured()) return;
  const team = getEnrollmentTeamBccEmails();
  if (team.length === 0) return;

  const base = getAppBaseUrl().replace(/\/$/, "");
  const studentUrl = `${base}/students/${encodeURIComponent(opts.leadId)}`;
  const subject = `Teacher feedback submitted — ${opts.studentName}`;
  const html = `<p><strong>${escapeHtml(opts.teacherName)}</strong> submitted demo feedback for <strong>${escapeHtml(opts.studentName)}</strong>.</p>
<p style="margin:12px 0;color:#424242;font-size:14px;">${escapeHtml(opts.demoSummary)}</p>
<ul style="margin:8px 0;padding-left:20px;">
<li>Rating: <strong>${escapeHtml(opts.ratingLabel)}</strong></li>
<li>Exam track: ${escapeHtml(opts.trackLabel)}</li>
<li>Recommended next: ${escapeHtml(opts.recommendedNextLabel)}</li>
</ul>
<p><a href="${studentUrl}" style="display:inline-block;background:#1565c0;color:#fff;padding:10px 16px;text-decoration:none;font-weight:600;">Open student in dashboard</a></p>
<p><small>If the button does not work: <br/><span style="word-break:break-all;">${studentUrl}</span></small></p>`;

  const to = team.join(", ");
  await sendMail({ to, subject, html });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
