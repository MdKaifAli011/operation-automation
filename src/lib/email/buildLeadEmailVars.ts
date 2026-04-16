import type {
  DemoTableRowPersisted,
  LeadPipelineMeta,
} from "@/lib/leadPipelineMetaTypes";
import type { EmailTemplateKey } from "@/lib/email/templateKeys";
import { demoInviteSummaryLine } from "@/lib/email/demoInviteSummary";
import { buildDemoStatusUpdatePremiumPlaceholders } from "@/lib/email/demoStatusUpdatePremiumContent";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";
import { getEnrollmentFormLink } from "@/lib/email/enrollmentFormLink";
import { getTeacherBlockDurationMinutes } from "@/lib/demoSchedule/durations";
import { format, parseISO } from "date-fns";

type LeanLead = {
  studentName?: string;
  parentName?: string;
  email?: string;
  phone?: string;
  country?: string;
  grade?: string;
  targetExams?: string[];
  pipelineMeta?: LeadPipelineMeta | Record<string, unknown> | null;
};

export type EmailRecipientKind =
  | "parent_or_student"
  | "parent"
  | "student"
  | "faculty"
  | "enrollment_team";

type LeadPipelineBaseVars = {
  studentName: string;
  parentName: string;
  email: string;
  phone: string;
  country: string;
  grade: string;
  targetExams: string;
  logoUrl: string;
  recipientGreeting: string;
  [k: string]: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Safe for HTML text nodes and template placeholders. */
export function escapeHtmlForEmail(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

const EMAIL_LOGO_URL =
  "https://testprepkart.com/self-study/_next/image?url=%2Fself-study%2Flogo.png&w=640&q=75";

export function buildLeadPipelineBaseVars(lead: LeanLead): LeadPipelineBaseVars {
  const targetExams = Array.isArray(lead.targetExams)
    ? lead.targetExams.filter((x) => typeof x === "string" && x.trim())
    : [];
  const studentName = str(lead.studentName) || "Student";
  const parentName = str(lead.parentName);
  const recipientGreeting = parentName || studentName || "Parent";
  return {
    studentName,
    parentName: parentName || "Parent",
    email: str(lead.email),
    phone: str(lead.phone),
    country: str(lead.country),
    grade: str(lead.grade),
    targetExams: targetExams.join(", ") || "—",
    logoUrl: EMAIL_LOGO_URL,
    recipientGreeting,
  };
}

function absUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getAppBaseUrl();
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

function parseIstSlot(isoDate: string, hm: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map((x) => parseInt(x, 10));
  if (h > 23 || m > 59 || Number.isNaN(h) || Number.isNaN(m)) return null;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${isoDate}T${hh}:${mm}:00+05:30`);
}

function formatTime12hInZone(d: Date, timeZone: string): string {
  const s = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return s.replace(/\b(AM|PM)\b/g, (x) => x.toUpperCase());
}

function scheduleText(meta: LeadPipelineMeta | Record<string, unknown>): string {
  const sched = meta.schedule as
    | { classes?: Array<Record<string, unknown>> }
    | undefined;
  const classes = Array.isArray(sched?.classes) ? sched!.classes! : [];
  if (classes.length === 0) return "—";
  return classes
    .map((c) => {
      const day = str(c.day);
      const subj = str(c.subject);
      const ist = str(c.timeIST);
      const teach = str(c.teacher);
      const dur = str(c.duration);
      const bits = [day, subj, ist && `IST ${ist}`, teach, dur].filter(Boolean);
      return bits.join(" · ");
    })
    .join("\n");
}

function feeSummaryText(meta: LeadPipelineMeta | Record<string, unknown>): string {
  const fees = meta.fees as
    | {
        finalFee?: number;
        currency?: string;
        installmentEnabled?: boolean;
        installmentCount?: number;
        installmentAmounts?: number[];
        installmentDates?: string[];
        scholarshipPct?: number;
      }
    | undefined;
  if (!fees) return "—";
  const finalFee =
    typeof fees.finalFee === "number" && Number.isFinite(fees.finalFee)
      ? fees.finalFee
      : 0;
  const cur = str(fees.currency) || "INR";
  const lines: string[] = [
    `Final fee: ${cur === "INR" ? `₹${finalFee.toLocaleString("en-IN")}` : `${finalFee} ${cur}`}`,
  ];
  if (fees.scholarshipPct && fees.scholarshipPct > 0) {
    lines.push(`Scholarship: ${fees.scholarshipPct}%`);
  }
  if (
    fees.installmentEnabled &&
    typeof fees.installmentCount === "number" &&
    fees.installmentCount > 0
  ) {
    lines.push(`Installments: ${fees.installmentCount}`);
    const amounts = Array.isArray(fees.installmentAmounts)
      ? fees.installmentAmounts
      : [];
    const dates = Array.isArray(fees.installmentDates) ? fees.installmentDates : [];
    for (let i = 0; i < fees.installmentCount; i++) {
      const a = amounts[i];
      const d = dates[i];
      if (a != null || d) {
        lines.push(
          `  ${i + 1}. ${a != null ? `₹${Number(a).toLocaleString("en-IN")}` : "—"}${d ? ` · due ${d}` : ""}`,
        );
      }
    }
  }
  return lines.join("\n");
}

export function buildLeadEmailVars(
  lead: LeanLead,
  key: EmailTemplateKey,
  opts?: {
    demoRowIndex?: number;
    recipientType?: EmailRecipientKind;
    recipientName?: string;
  },
): Record<string, string> {
  const meta = (lead.pipelineMeta ?? {}) as LeadPipelineMeta &
    Record<string, unknown>;
  const base0 = buildLeadPipelineBaseVars(lead);
  const recipientType = opts?.recipientType ?? "parent_or_student";
  const recipientName = str(opts?.recipientName);
  const parentName = str(lead.parentName);
  const studentName = str(lead.studentName) || "Student";
  const recipientGreeting =
    recipientType === "enrollment_team"
      ? "Enrollment Team"
      : recipientType === "faculty"
        ? recipientName || "Faculty"
        : recipientType === "student"
          ? studentName
          : recipientType === "parent"
            ? parentName || "Parent"
            : parentName || studentName || "Parent";
  const base: LeadPipelineBaseVars = { ...base0, recipientGreeting };

  if (key === "demo_invite") {
    const demo = meta.demo as { rows?: unknown[] } | undefined;
    const rows = Array.isArray(demo?.rows) ? demo!.rows! : [];
    const idx =
      typeof opts?.demoRowIndex === "number" && opts.demoRowIndex >= 0
        ? opts.demoRowIndex
        : 0;
    const row = rows[idx] as DemoTableRowPersisted | undefined;
    const demoSummary = row ? demoInviteSummaryLine(row) : "—";
    const meetLink = str(row?.meetLinkUrl);
    const slot =
      row && row.isoDate && row.timeHmIST
        ? parseIstSlot(str(row.isoDate), str(row.timeHmIST))
        : null;
    const sessionDate =
      row?.isoDate && slot ? format(parseISO(row.isoDate), "d MMM yyyy") : "—";
    const sessionTime = slot
      ? formatTime12hInZone(slot, "Asia/Kolkata")
      : str(row?.timeHmIST) || "—";
    const subject = str(row?.subject) || "—";
    const facultyName = str(row?.teacher) || "—";
    const durationMinutes = getTeacherBlockDurationMinutes();
    const duration = `${durationMinutes} minutes`;
    const sessionLink = meetLink;
    return {
      ...base,
      demoSummary,
      meetLink,
      sessionDate,
      sessionTime,
      subject,
      facultyName,
      duration,
      sessionLink,
    };
  }

  if (key === "demo_status_update") {
    const demo = meta.demo as { rows?: unknown[] } | undefined;
    const rows = Array.isArray(demo?.rows) ? demo!.rows! : [];
    const idx =
      typeof opts?.demoRowIndex === "number" && opts.demoRowIndex >= 0
        ? opts.demoRowIndex
        : 0;
    const row = rows[idx] as DemoTableRowPersisted | undefined;
    const demoSummary = row ? demoInviteSummaryLine(row) : "—";
    const premium = buildDemoStatusUpdatePremiumPlaceholders(
      row,
      base.recipientGreeting,
      base.studentName,
    );
    return {
      ...base,
      ...premium,
      demoSummary,
    };
  }

  if (key === "brochure") {
    const sr = meta.studentReport as
      | { pdfUrl?: string | null; fileName?: string | null }
      | undefined;
    const reportPath = str(sr?.pdfUrl);
    if (reportPath) {
      const brochureLink = absUrl(reportPath);
      const brochureLabel =
        str(sr?.fileName) || "Student progress report";
      const brochureBundleHtml = `<p style="margin:12px 0 6px;font-weight:600;">Student progress report</p><p style="margin:4px 0;"><a href="${escapeAttr(brochureLink)}">${escapeHtmlForEmail(brochureLabel)}</a></p>`;
      return { ...base, brochureLabel, brochureLink, brochureBundleHtml };
    }
    const br = meta.brochure as
      | {
          fileName?: string | null;
          storedFileUrl?: string | null;
          documentUrl?: string | null;
        }
      | undefined;
    const doc = str(br?.documentUrl);
    const stored = str(br?.storedFileUrl);
    const brochureLink = doc ? absUrl(doc) : stored ? absUrl(stored) : "";
    const brochureLabel =
      str(br?.fileName) ||
      (doc ? "Linked document" : stored ? "Uploaded brochure" : "Course brochure");
    const brochureBundleHtml = brochureLink
      ? `<p style="margin:12px 0 6px;font-weight:600;">Document</p><ul style="margin:0;padding-left:20px;"><li style="margin:6px 0;"><strong>${escapeHtmlForEmail(brochureLabel)}</strong> — <a href="${escapeAttr(brochureLink)}">Open</a></li></ul>`
      : '<p style="color:#757575;">No brochure link is set on this lead yet. Add a document under Step 2 or pick catalog brochures when sending.</p>';
    return { ...base, brochureLabel, brochureLink, brochureBundleHtml };
  }

  if (key === "fees") {
    const fees = meta.fees as { finalFee?: number; currency?: string } | undefined;
    const finalFee =
      typeof fees?.finalFee === "number" && Number.isFinite(fees.finalFee)
        ? fees.finalFee
        : 0;
    const feeCurrency = str(fees?.currency) || "INR";
    const feeFinal =
      feeCurrency === "INR"
        ? `₹${finalFee.toLocaleString("en-IN")}`
        : `${finalFee} ${feeCurrency}`;
    const feeSummary = feeSummaryText(meta);
    const feeSummaryHtml = `<div style="margin:12px 0 16px;border:1px solid #bbdefb;border-radius:8px;overflow:hidden;max-width:560px;">
<div style="background:#e3f2fd;padding:10px 14px;font-weight:700;font-size:13px;color:#0d47a1;letter-spacing:0.03em;">Fee summary</div>
<div style="background:#fafafa;padding:14px 16px;">
<pre style="margin:0;font-family:ui-monospace,Consolas,'Segoe UI Mono',monospace;font-size:14px;line-height:1.55;white-space:pre-wrap;color:#212121;">${escapeHtmlForEmail(feeSummary)}</pre>
</div>
</div>`;
    return {
      ...base,
      feeFinal,
      feeCurrency,
      feeSummary,
      feeSummaryHtml,
      /** Filled server-side when sending (see mergeFeeEmailVarsWithBankDetails). */
      feeBankDetailsHtml: "",
    };
  }

  if (key === "enrollment") {
    return { ...base, enrollmentLink: getEnrollmentFormLink() };
  }

  if (key === "schedule") {
    const scheduleSummary = scheduleText(meta);
    return { ...base, scheduleSummary };
  }

  return base;
}
