import type {
  DemoTableRowPersisted,
  LeadPipelineMeta,
} from "@/lib/leadPipelineMetaTypes";
import type { EmailTemplateKey } from "@/lib/email/templateKeys";
import { demoInviteSummaryLine } from "@/lib/email/demoInviteSummary";
import { getAppBaseUrl } from "@/lib/email/appBaseUrl";

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function absUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getAppBaseUrl();
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
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
  opts?: { demoRowIndex?: number },
): Record<string, string> {
  const meta = (lead.pipelineMeta ?? {}) as LeadPipelineMeta &
    Record<string, unknown>;
  const targetExams = Array.isArray(lead.targetExams)
    ? lead.targetExams.filter((x) => typeof x === "string" && x.trim())
    : [];
  const base: Record<string, string> = {
    studentName: str(lead.studentName) || "Student",
    parentName: str(lead.parentName) || "Parent",
    email: str(lead.email),
    phone: str(lead.phone),
    country: str(lead.country),
    grade: str(lead.grade),
    targetExams: targetExams.join(", ") || "—",
  };

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
    return { ...base, demoSummary, meetLink };
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
      return { ...base, brochureLabel, brochureLink };
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
    return { ...base, brochureLabel, brochureLink };
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
    return { ...base, feeFinal, feeCurrency, feeSummary };
  }

  if (key === "enrollment") {
    const enrollmentLink =
      process.env.ENROLLMENT_FORM_URL?.trim() ||
      process.env.NEXT_PUBLIC_ENROLLMENT_FORM_URL?.trim() ||
      `${getAppBaseUrl()}/enroll-student`;
    return { ...base, enrollmentLink };
  }

  if (key === "schedule") {
    const scheduleSummary = scheduleText(meta);
    return { ...base, scheduleSummary };
  }

  return base;
}
