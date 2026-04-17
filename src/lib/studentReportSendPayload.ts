import type { Lead } from "@/lib/types";
import type { LeadPipelineStudentReport } from "@/lib/leadPipelineMetaTypes";
import {
  listStudentReportFiles,
  resolveStudentReportRowsForUrls,
} from "@/lib/studentReportVersions";

/** Builds pipeline fragments after a successful “send report” email. */
export function prepareStudentReportEmailSentUpdate(
  lead: Lead,
  pdfUrls: string[],
  nowIso: string,
): {
  studentReportPartial: Partial<LeadPipelineStudentReport>;
  documentsItems: Array<Record<string, unknown>>;
  activityDescription: string;
} {
  const sr = lead.pipelineMeta?.studentReport as
    | LeadPipelineStudentReport
    | undefined;
  const resolved = resolveStudentReportRowsForUrls(sr, pdfUrls);
  const first = resolved[0];
  const names = resolved.map((r) => r.fileName).join(", ");
  const nFiles = listStudentReportFiles(sr).length;
  const countLabel = String(Math.max(1, nFiles));

  const docsItems = Array.isArray(
    (
      lead.pipelineMeta as
        | { documents?: { items?: Array<Record<string, unknown>> } }
        | undefined
    )?.documents?.items,
  )
    ? [
        ...((
          lead.pipelineMeta as
            | { documents?: { items?: Array<Record<string, unknown>> } }
            | undefined
        )?.documents?.items ?? []),
      ]
    : [];
  const reportIdx = docsItems.findIndex(
    (x) => String(x?.key ?? "").trim() === "report",
  );
  if (reportIdx >= 0) {
    docsItems[reportIdx] = {
      ...docsItems[reportIdx],
      sentAt: nowIso,
      countLabel,
    };
  } else {
    docsItems.push({
      key: "report",
      title: "Demo Session Report - Feedback",
      countLabel,
      sentAt: nowIso,
    });
  }

  const activityDescription =
    resolved.length > 1
      ? `Student progress report emailed (${resolved.length} PDFs: ${names}).`
      : `Student progress report emailed (${names}).`;

  return {
    studentReportPartial: {
      sendConfirmedAt: nowIso,
      lastSentPdfUrl: first?.pdfUrl ?? pdfUrls[0] ?? null,
      lastSentPdfUrls: pdfUrls.length > 0 ? [...pdfUrls] : null,
      lastSentAt: nowIso,
      activeSendPdfUrl: first?.pdfUrl ?? null,
      activeSendFileName: first?.fileName ?? null,
    },
    documentsItems: docsItems,
    activityDescription,
  };
}
