export async function sendLeadPipelineEmail(
  leadId: string,
  body: {
    templateKey: string;
    demoRowIndex?: number;
    meetRowId?: string;
    demoStatusEmail?: {
      status: "Scheduled" | "Completed" | "Cancelled";
      row?: Record<string, unknown>;
      notifyParent?: boolean;
      notifyFaculty?: boolean;
    };
    brochureEmail?: {
      selectionKeys: string[];
      includeStudentReportPdf: boolean;
      studentReportPdfUrls?: string[];
    };
    scheduleEmail?: {
      attachSchedulePdf?: boolean;
    };
  },
): Promise<void> {
  const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: { error?: string } = {};
  try {
    data = (await res.json()) as { error?: string };
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" && data.error
        ? data.error
        : `Email send failed (${res.status}).`,
    );
  }
}
