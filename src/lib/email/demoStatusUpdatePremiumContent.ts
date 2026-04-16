import { format, parseISO } from "date-fns";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function absMeetLink(url: string): string {
  const t = url.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getAppBaseUrl();
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

/** IST wall-clock → instant (aligned with demo invite summary). */
function parseIstSlot(isoDate: string, hm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (h > 23 || m > 59 || Number.isNaN(h) || Number.isNaN(m)) return null;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:${mm}:00+05:30`);
}

function formatTime12hIst(d: Date): string {
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return s.replace(/\b(AM|PM)\b/g, (x) => x.toLowerCase());
}

function sessionDetailsCardHtml(row: DemoTableRowPersisted): string {
  const subject = str(row.subject) || "—";
  const teacher = str(row.teacher) || "—";
  const slot = parseIstSlot(row.isoDate, row.timeHmIST);
  const dateLine = slot
    ? `${format(parseISO(row.isoDate), "EEEE, d MMMM yyyy")} · ${formatTime12hIst(slot)} IST`
    : str(row.isoDate) || "—";
  const tzNote = str(row.studentTimeZone)
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#616161;">We will share times in your local zone where applicable; the session runs on <strong>India Standard Time (IST)</strong> as shown above.</p>`
    : "";

  const rowStyle = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #eeeeee;vertical-align:top;width:120px;font-size:12px;font-weight:600;color:#757575;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtmlForEmail(label)}</td><td style="padding:10px 0;border-bottom:1px solid #eeeeee;font-size:15px;color:#212121;">${escapeHtmlForEmail(value)}</td></tr>`;

  return `<div style="margin:20px 0;max-width:560px;border-radius:12px;overflow:hidden;border:1px solid #e3f2fd;box-shadow:0 2px 8px rgba(13,71,161,0.06);">
<div style="padding:14px 20px;background:linear-gradient(135deg,#1565c0 0%,#0d47a1 100%);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">Session details</div>
<div style="padding:8px 20px 20px;background:#ffffff;">
<table role="presentation" style="width:100%;border-collapse:collapse;margin:0;">${rowStyle("Focus", subject)}${rowStyle("Educator", teacher)}${rowStyle("When", dateLine)}</table>
${tzNote}
</div>
</div>`;
}

function meetLinkBlockHtml(meetAbs: string): string {
  const safe = escapeAttr(meetAbs);
  const label = escapeHtmlForEmail("Join your trial class");
  return `<div style="margin:24px 0;max-width:560px;padding:20px 22px;background:#e8f5e9;border-radius:12px;border:1px solid #a5d6a7;">
<p style="margin:0 0 14px;font-size:14px;line-height:1.55;color:#1b5e20;font-weight:600;">Your video link is ready</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0;">
<tr><td style="border-radius:8px;background:#2e7d32;">
<a href="${safe}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a>
</td></tr>
</table>
<p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#33691e;word-break:break-all;">If the button does not work, copy this link into your browser:<br/><a href="${safe}" style="color:#1565c0;">${escapeHtmlForEmail(meetAbs)}</a></p>
</div>`;
}

function pendingLinkNoticeHtml(): string {
  return `<div style="margin:24px 0;max-width:560px;padding:18px 20px;background:#fff8e1;border-radius:12px;border:1px solid #ffe082;">
<p style="margin:0;font-size:14px;line-height:1.6;color:#5d4037;"><strong>Video link</strong> — Your secure meeting link is being finalized. You will receive it shortly in another message, or it may already appear in your student portal. The <strong>date and time</strong> above are confirmed.</p>
</div>`;
}

/**
 * Parent-facing copy for automatic demo status emails (scheduled / conducted / canceled).
 * Omits meeting links entirely for canceled and conducted states.
 */
export function buildDemoStatusUpdatePremiumPlaceholders(
  row: DemoTableRowPersisted | undefined,
  recipientGreeting: string,
  studentName: string,
): Record<string, string> {
  const parent = recipientGreeting.trim() || "there";
  const student = studentName.trim() || "your child";
  const raw = str(row?.status);
  const status: "Scheduled" | "Completed" | "Cancelled" =
    raw === "Completed" || raw === "Cancelled" ? raw : "Scheduled";

  const meetRaw = str(row?.meetLinkUrl);
  const meetAbs = absMeetLink(meetRaw);
  const hasMeet =
    status === "Scheduled" &&
    Boolean(meetAbs && /^https?:\/\//i.test(meetAbs));

  const detailsHtml =
    row && status !== "Cancelled" ? sessionDetailsCardHtml(row) : "";

  if (status === "Cancelled") {
    return {
      demoStatusEmailSubject: `Update on the trial class — ${student}`,
      demoStatusEmailBodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">Dear ${escapeHtmlForEmail(parent)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">We are writing to let you know that the <strong>trial class</strong> we had discussed for <strong>${escapeHtmlForEmail(student)}</strong> will <strong>not go ahead</strong> as previously planned.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">We are not sharing a video link for this session. If you would like to arrange a new time or have questions, please reply to this email — we will be glad to help.</p>
<p style="margin:20px 0 0;font-size:15px;line-height:1.65;color:#37474f;">Thank you for your understanding.</p>`,
      demoStatusMeetSectionHtml: "",
      demoStatusLabel: "Trial canceled",
      meetLink: "",
      demoStatus: "Cancelled",
    };
  }

  if (status === "Completed") {
    return {
      demoStatusEmailSubject: `Thank you — ${student}'s trial class`,
      demoStatusEmailBodyHtml: `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">Dear ${escapeHtmlForEmail(parent)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">Thank you for taking the time to join us for <strong>${escapeHtmlForEmail(student)}</strong>&rsquo;s trial class. We hope the session was clear, engaging, and helpful for your family.</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">Our team will follow up with you on <strong>next steps</strong>, including any questions you may have about the program or enrollment.</p>
${detailsHtml}
<p style="margin:20px 0 0;font-size:15px;line-height:1.65;color:#37474f;">We appreciate your trust in us.</p>`,
      demoStatusMeetSectionHtml: "",
      demoStatusLabel: "Trial completed",
      meetLink: "",
      demoStatus: "Completed",
    };
  }

  const bodyIntro = `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">Dear ${escapeHtmlForEmail(parent)},</p>
<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#37474f;">We are pleased to confirm <strong>${escapeHtmlForEmail(student)}</strong>&rsquo;s <strong>trial class</strong>. Please save the details below.</p>`;

  const meetSection = hasMeet
    ? meetLinkBlockHtml(meetAbs)
    : pendingLinkNoticeHtml();

  const closing = `<p style="margin:20px 0 0;font-size:15px;line-height:1.65;color:#37474f;">Please join a few minutes early. If you need to reschedule, reply to this email and we will arrange an alternative time.</p>`;

  return {
    demoStatusEmailSubject: `Trial class confirmed for ${student}`,
    demoStatusEmailBodyHtml: `${bodyIntro}${detailsHtml}${closing}`,
    demoStatusMeetSectionHtml: meetSection,
    demoStatusLabel: "Trial scheduled",
    meetLink: hasMeet ? meetAbs : "",
    demoStatus: "Scheduled",
  };
}
