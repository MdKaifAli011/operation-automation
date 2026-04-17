import type { LeadPipelineMeta } from "@/lib/leadPipelineMetaTypes";
import {
  buildLeadPipelineBaseVars,
  escapeHtmlForEmail,
} from "@/lib/email/buildLeadEmailVars";
import {
  resolveStudentReportSendTarget,
  resolveStudentReportRowsForUrls,
} from "@/lib/studentReportVersions";
import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";
import { resolveBrochureEmailItemsOrdered } from "@/lib/email/resolveBrochureEmailSelection";
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

function absUrl(pathOrUrl: string): string {
  const t = pathOrUrl.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = getAppBaseUrl();
  if (t.startsWith("/")) return `${base}${t}`;
  return `${base}/${t}`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function buildReportPdfBundleHtml(
  reportRows: Array<{ title: string; href: string }>,
): string {
  if (reportRows.length === 0) return "";
  const header =
    reportRows.length > 1
      ? "Student progress reports (PDFs)"
      : "Student progress report (PDF)";
  const blocks = reportRows
    .map((reportRow, i) => {
      const top = i === 0 ? "0" : "12px";
      return `<div style="margin-top:${top};padding-top:${i === 0 ? "0" : "12px"};border-top:${i === 0 ? "none" : "1px solid #e0e0e0"};">
<p style="margin:0 0 8px;font-weight:600;color:#212121;">${escapeHtmlForEmail(reportRow.title)}</p>
<a href="${escapeAttr(reportRow.href)}" style="display:inline-block;padding:8px 14px;background:#558b2f;color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open PDF</a>
<p style="margin:8px 0 0;font-size:11px;color:#9e9e9e;word-break:break-all;line-height:1.35;">${escapeHtmlForEmail(reportRow.href)}</p>
</div>`;
    })
    .join("");
  return `<div style="margin:8px 0 16px;border:1px solid #c5e1a5;border-radius:8px;overflow:hidden;max-width:600px;">
<div style="background:#f1f8e9;padding:10px 14px;font-weight:700;font-size:14px;color:#33691e;">${escapeHtmlForEmail(header)}</div>
<div style="padding:14px 16px;background:#fafafa;">${blocks}</div>
</div>`;
}

function buildBrochureBundleHtmlBlock(
  brochureRows: Array<{ title: string; href: string }>,
  reportRows: Array<{ title: string; href: string }>,
): string {
  const parts: string[] = [];
  if (brochureRows.length > 0) {
    const rows = brochureRows
      .map(
        (r, i) =>
          `<tr>
<td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #eeeeee;font-size:13px;color:#616161;width:36px;">${i + 1}.</td>
<td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #eeeeee;">
<div style="font-weight:600;color:#1565c0;font-size:15px;margin-bottom:8px;">${escapeHtmlForEmail(r.title)}</div>
<a href="${escapeAttr(r.href)}" style="display:inline-block;padding:8px 14px;background:#1565c0;color:#ffffff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open document</a>
<p style="margin:8px 0 0;font-size:11px;color:#9e9e9e;word-break:break-all;line-height:1.35;">${escapeHtmlForEmail(r.href)}</p>
</td>
</tr>`,
      )
      .join("");
    parts.push(
      `<div style="margin:4px 0 16px;border:1px solid #bbdefb;border-radius:8px;overflow:hidden;max-width:600px;">
<div style="background:linear-gradient(180deg,#e3f2fd 0%,#bbdefb 100%);padding:12px 14px;font-weight:700;font-size:14px;color:#0d47a1;">Course brochures (by target exam)</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fafafa;">${rows}</table>
</div>`,
    );
  }
  const reportHtml = buildReportPdfBundleHtml(reportRows);
  if (reportHtml) parts.push(reportHtml);
  if (parts.length === 0) {
    return '<p style="color:#757575;">No documents were included in this email.</p>';
  }
  return parts.join("");
}

export { ensureBrochureBundleHtmlInRenderedHtml } from "@/lib/email/templateRenderedEnsures";

/** Builds vars for brochure template when staff selects specific brochures and/or the PDF report. */
export async function buildBrochureBundleEmailVars(
  lead: LeanLead,
  bundle: {
    selectionKeys: string[];
    includeStudentReportPdf: boolean;
    /** When set, these paths replace the single active-send target (must be known on the lead). */
    studentReportPdfUrls?: string[] | null;
  },
): Promise<Record<string, string>> {
  const base = buildLeadPipelineBaseVars(lead);

  const brochureItems =
    bundle.selectionKeys.length > 0
      ? await resolveBrochureEmailItemsOrdered(lead, bundle.selectionKeys)
      : [];

  const meta = (lead.pipelineMeta ?? {}) as Record<string, unknown>;
  const sr = meta.studentReport as LeadPipelineStudentReport | undefined;
  const sendTarget = resolveStudentReportSendTarget(sr);
  const reportPath = sendTarget?.pdfUrl?.trim() ?? "";

  const explicitRaw = Array.isArray(bundle.studentReportPdfUrls)
    ? bundle.studentReportPdfUrls
    : [];
  const explicitSeen = new Set<string>();
  const explicitUrls: string[] = [];
  for (const u of explicitRaw) {
    const t = String(u ?? "").trim();
    if (!t || explicitSeen.has(t)) continue;
    explicitSeen.add(t);
    explicitUrls.push(t);
  }

  let reportRows: Array<{ title: string; href: string }> = [];
  if (bundle.includeStudentReportPdf) {
    if (explicitUrls.length > 0) {
      const resolved = resolveStudentReportRowsForUrls(sr, explicitUrls);
      if (resolved.length !== explicitUrls.length) {
        throw new Error(
          "One or more selected report files are not on this lead. Refresh and try again.",
        );
      }
      reportRows = resolved.map((r) => ({
        title: r.fileName,
        href: absUrl(r.pdfUrl),
      }));
    } else {
      if (!reportPath || !sendTarget) {
        throw new Error(
          "Student progress report PDF is not available. Generate or pick a version in the report dialog first.",
        );
      }
      reportRows = [
        {
          title: sendTarget.fileName,
          href: absUrl(reportPath),
        },
      ];
    }
  }

  const brochureRows = brochureItems.map((x) => ({ title: x.title, href: x.href }));

  if (brochureRows.length === 0 && reportRows.length === 0) {
    throw new Error(
      "Choose at least one brochure or include the student progress report.",
    );
  }

  const brochureBundleHtml = buildBrochureBundleHtmlBlock(brochureRows, reportRows);

  const firstHref = brochureRows[0]?.href ?? reportRows[0]?.href ?? "";
  const brochureLabel =
    brochureRows.length === 0
      ? reportRows.length === 1
        ? reportRows[0]!.title
        : reportRows.length > 1
          ? `${reportRows.length} progress reports`
          : "Documents"
      : brochureRows.length === 1
        ? brochureRows[0]!.title
        : `${brochureRows.length} documents`;
  const brochureLink = firstHref;

  return {
    ...base,
    brochureLabel,
    brochureLink,
    brochureBundleHtml,
  };
}
