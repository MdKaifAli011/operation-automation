import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";

export type ReportFileListItem = {
  id: string;
  pdfUrl: string;
  fileName: string;
  generatedAt: string | null;
  source?: string;
  /** True when this row is the current latest on the lead */
  isLatest: boolean;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** All report PDFs for this lead: older entries + current `pdfUrl` (newest last). */
export function listStudentReportFiles(
  sr: LeadPipelineStudentReport | undefined | null,
): ReportFileListItem[] {
  const raw = sr ?? {};
  const hist = Array.isArray(raw.versionHistory) ? raw.versionHistory : [];
  const out: ReportFileListItem[] = [];
  for (const h of hist) {
    const url = str(h?.pdfUrl);
    if (!url) continue;
    out.push({
      id: str(h?.id) || url,
      pdfUrl: url,
      fileName: str(h?.fileName) || "Demo session report.pdf",
      generatedAt: str(h?.generatedAt) || null,
      source: str(h?.source),
      isLatest: false,
    });
  }
  const cur = str(raw.pdfUrl);
  if (cur) {
    out.push({
      id: "current",
      pdfUrl: cur,
      fileName: str(raw.fileName) || "Demo session report.pdf",
      generatedAt: str(raw.generatedAt) || null,
      source: str(raw.source),
      isLatest: true,
    });
  }
  return out;
}

/** Newest-first list for modals */
export function listStudentReportFilesNewestFirst(
  sr: LeadPipelineStudentReport | undefined | null,
): ReportFileListItem[] {
  const list = listStudentReportFiles(sr);
  return [...list].reverse();
}

/** PDF path and label to use when emailing the student report */
export function resolveStudentReportSendTarget(
  sr: LeadPipelineStudentReport | undefined | null,
): { pdfUrl: string; fileName: string } | null {
  const raw = sr ?? {};
  const activeUrl = str(raw.activeSendPdfUrl);
  const latest = str(raw.pdfUrl);
  const url = activeUrl || latest;
  if (!url) return null;

  if (activeUrl && str(raw.activeSendFileName)) {
    return { pdfUrl: activeUrl, fileName: str(raw.activeSendFileName) };
  }
  if (latest && url === latest && str(raw.fileName)) {
    return { pdfUrl: latest, fileName: str(raw.fileName) };
  }
  const hist = Array.isArray(raw.versionHistory) ? raw.versionHistory : [];
  const hit = hist.find((h) => str(h?.pdfUrl) === url);
  if (hit && str(hit.fileName)) {
    return { pdfUrl: url, fileName: str(hit.fileName) };
  }
  return { pdfUrl: url, fileName: "Student progress report.pdf" };
}

/** Resolve known report URLs to stable labels (order preserved, skips unknown). */
export function resolveStudentReportRowsForUrls(
  sr: LeadPipelineStudentReport | undefined | null,
  urls: string[],
): Array<{ pdfUrl: string; fileName: string }> {
  const allowed = listStudentReportFiles(sr);
  const byUrl = new Map(
    allowed.map((f) => [f.pdfUrl.trim(), f] as const),
  );
  const seen = new Set<string>();
  const out: Array<{ pdfUrl: string; fileName: string }> = [];
  for (const raw of urls) {
    const u = String(raw ?? "").trim();
    if (!u || seen.has(u)) continue;
    const hit = byUrl.get(u);
    if (!hit) continue;
    seen.add(u);
    out.push({ pdfUrl: hit.pdfUrl, fileName: hit.fileName });
  }
  return out;
}

/** Public path under this lead’s report storage (generated PDFs or modal upload). */
export function isStudentReportPdfUrlForLead(
  leadId: string,
  pdfUrl: string,
): boolean {
  const u = String(pdfUrl ?? "").trim();
  if (!u) return false;
  const sr = `/uploads/student-reports/${leadId}/`;
  const docs = `/uploads/lead-documents/${leadId}/`;
  return u.startsWith(sr) || u.startsWith(docs);
}
