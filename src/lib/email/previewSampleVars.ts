import type { EmailTemplateKey } from "@/lib/email/templateKeys";

/** Neutral placeholders for preview only — real sends use data from each lead. */
export function getPreviewSampleVars(key: EmailTemplateKey): Record<string, string> {
  const base: Record<string, string> = {
    studentName: "Student name",
    parentName: "Parent name",
    email: "email@address",
    phone: "Phone number",
    country: "Country",
    grade: "Class / grade",
    targetExams: "Target exam(s)",
    logoUrl: "https://example.com/logo.png",
  };

  switch (key) {
    case "demo_invite":
      return {
        ...base,
        sessionDate: "18 Apr 2026",
        sessionTime: "07:00 PM",
        subject: "Biology",
        facultyName: "Dr. Sharma",
        duration: "60 minutes",
        sessionLink: "https://meet.google.com/abc-defg-hij",
        demoSummary: "Subject · Teacher · Date · Time (timezone)",
        meetLink: "https://meet.google.com/abc-defg-hij",
      };
    case "brochure":
      return {
        ...base,
        brochureLabel: "2 documents",
        brochureLink: "https://example.com/sample-brochure.pdf",
        brochureBundleHtml: `<div style="margin:4px 0 16px;border:1px solid #bbdefb;border-radius:8px;overflow:hidden;max-width:600px;">
<div style="background:linear-gradient(180deg,#e3f2fd 0%,#bbdefb 100%);padding:12px 14px;font-weight:700;font-size:14px;color:#0d47a1;">Course brochures (by target exam)</div>
<table style="width:100%;border-collapse:collapse;background:#fafafa;"><tr><td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #eee;width:36px;">1.</td><td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #eee;"><div style="font-weight:600;color:#1565c0;font-size:15px;margin-bottom:8px;">JEE · Physics overview</div><a href="#" style="display:inline-block;padding:8px 14px;background:#1565c0;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open document</a></td></tr>
<tr><td style="padding:10px 12px;vertical-align:top;width:36px;">2.</td><td style="padding:10px 12px;vertical-align:top;"><div style="font-weight:600;color:#1565c0;font-size:15px;margin-bottom:8px;">NEET · Biology brochure</div><a href="#" style="display:inline-block;padding:8px 14px;background:#1565c0;color:#fff;text-decoration:none;border-radius:4px;font-size:13px;font-weight:600;">Open document</a></td></tr></table></div>`,
      };
    case "demo_status_update":
      return {
        ...base,
        demoStatus: "scheduled",
        demoStatusLabel: "Scheduled",
        demoSummary: "Biology · Faculty name · 18 Apr 2026 · 07:00 PM IST",
        meetLink: "https://meet.google.com/abc-defg-hij",
        demoStatusEmailSubject: "Demo scheduled for Student name",
        demoStatusEmailBodyHtml:
          "<p style='margin:0 0 12px;font-size:14px;line-height:1.7;'>The demo for <strong>Student name</strong> has been scheduled successfully. Please keep the student ready 10 minutes early.</p>",
        demoStatusMeetSectionHtml:
          "<p style='margin:0;font-size:14px;line-height:1.7;'>Join link: <a href='https://meet.google.com/abc-defg-hij'>https://meet.google.com/abc-defg-hij</a></p>",
      };
    case "courier_address":
      return base;
    case "bank_details": {
      const feeBankDetailsHtml = `<div style="border:1px solid #c8e6c9;border-radius:8px;overflow:hidden;max-width:560px;"><div style="background:#e8f5e9;padding:12px 16px;font-weight:700;font-size:14px;color:#1b5e20;">Sample · Main fee account</div><table style="width:100%;border-collapse:collapse;background:#fafafa;"><tr><td style="padding:8px 14px;font-size:12px;color:#616161;">IFSC</td><td style="padding:8px 14px;font-size:14px;">HDFC0001234</td></tr></table></div>`;
      return { ...base, feeBankDetailsHtml };
    }
    case "fees": {
      const feeSummary = [
        "Final fee: (amount)",
        "Scholarship: (if any)",
        "Installments: (count)",
        "  1. (amount) · due (date)",
      ].join("\n");
      const feeSummaryHtml = `<div style="border:1px solid #bbdefb;border-radius:8px;overflow:hidden;max-width:560px;"><div style="background:#e3f2fd;padding:10px 14px;font-weight:700;font-size:13px;color:#0d47a1;">Fee summary</div><div style="background:#fafafa;padding:14px 16px;"><pre style="margin:0;font-family:monospace;font-size:14px;white-space:pre-wrap;">${feeSummary.replace(/</g, "&lt;")}</pre></div></div>`;
      const feeBankDetailsHtml = `<div style="border:1px solid #c8e6c9;border-radius:8px;overflow:hidden;max-width:560px;"><div style="background:#e8f5e9;padding:12px 16px;font-weight:700;font-size:14px;color:#1b5e20;">Sample · Main fee account</div><table style="width:100%;border-collapse:collapse;background:#fafafa;"><tr><td style="padding:8px 14px;font-size:12px;color:#616161;">IFSC</td><td style="padding:8px 14px;font-size:14px;">HDFC0001234</td></tr></table></div>`;
      return {
        ...base,
        feeFinal: "(amount)",
        feeCurrency: "INR",
        feeSummary,
        feeSummaryHtml,
        feeBankDetailsHtml,
      };
    }
    case "enrollment":
      return {
        ...base,
        enrollmentLink: "https://…",
      };
    case "schedule":
      return {
        ...base,
        scheduleSummary: [
          "Day · Subject · Time · Teacher · Duration",
          "…",
        ].join("\n"),
      };
    default:
      return base;
  }
}
