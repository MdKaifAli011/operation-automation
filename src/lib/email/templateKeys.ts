export const EMAIL_TEMPLATE_KEYS = [
  "demo_invite",
  /** Fired when a demo row status becomes Scheduled, Completed, or Cancelled (student + teacher CC + enrollment BCC). */
  "demo_status_update",
  "brochure",
  /** Step 2: request full postal address and contact details for document dispatch. */
  "courier_address",
  /** Step 2: share selected institute bank account details only (no fee summary). */
  "bank_details",
  "fees",
  "enrollment",
  /** Composite (not a DB row): fee + enrollment in one email, BCC enrollment team. */
  "fees_enrollment_bundle",
  "schedule",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export function isEmailTemplateKey(k: string): k is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(k);
}

export type EmailTemplateMetaEntry = {
  name: string;
  description: string;
  placeholders: string[];
  /** Shown in Email Templates editor — sending behavior and env vars */
  editorTips?: readonly string[];
};

export const EMAIL_TEMPLATE_META: Record<EmailTemplateKey, EmailTemplateMetaEntry> = {
  demo_invite: {
    name: "Demo invite",
    description:
      "Sent when staff taps Share → Send link on a demo row. Teacher CC when listed on the demo; enrollment team BCC when ENROLLMENT_TEAM_BCC is set.",
    editorTips: [
      "Uses the selected demo row to fill date, time, subject, faculty, duration, and session link.",
      "{{sessionLink}} and {{meetLink}} point to the same demo join URL.",
      "On send, faculty receives a separate dedicated UI email to their configured address.",
      "Enrollment team receives BCC if ENROLLMENT_TEAM_BCC is configured in .env.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
      "{{sessionDate}}",
      "{{sessionTime}}",
      "{{subject}}",
      "{{facultyName}}",
      "{{duration}}",
      "{{sessionLink}}",
      "{{demoSummary}}",
      "{{meetLink}}",
    ],
  },
  demo_status_update: {
    name: "Demo status update",
    description:
      "Sent automatically when staff sets a trial row to scheduled, conducted, or canceled. Same routing as demo invite: student To, teacher CC when on file, enrollment BCC from ENROLLMENT_TEAM_BCC. Copy is parent-friendly; meeting links appear only for scheduled rows.",
    editorTips: [
      "Use {{demoStatusEmailSubject}} for the full subject line (set per status by the app).",
      "{{demoStatusEmailBodyHtml}} is the main letter; {{demoStatusMeetSectionHtml}} adds the green join button (scheduled + link) or a “link pending” note — empty after conduct/cancel.",
      "{{demoSummary}} remains a plain one-line summary for custom blocks; {{demoStatusLabel}} is a short log label.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
      "{{demoStatus}}",
      "{{demoStatusLabel}}",
      "{{demoSummary}}",
      "{{meetLink}}",
      "{{demoStatusEmailSubject}}",
      "{{demoStatusEmailBodyHtml}}",
      "{{demoStatusMeetSectionHtml}}",
    ],
  },
  brochure: {
    name: "Brochure & documents",
    description:
      "Step 2 · Documents: staff choose one or more catalog brochures (by target exam) and/or the confirmed progress report PDF. One email; enrollment team BCC when ENROLLMENT_TEAM_BCC is set.",
    editorTips: [
      "Put {{brochureBundleHtml}} in the body — it expands to a styled list of every selected brochure link or uploaded file, plus the report section if included.",
      "If your body omits {{brochureBundleHtml}}, the app appends the bundle so links still appear (legacy templates).",
      "{{brochureLink}} is the first document URL (for quick single-link use); {{brochureLabel}} is a short label.",
      "Requires brochureEmail from the app (selectionKeys + includeStudentReportPdf) — not editable from raw API without that payload.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
      "{{brochureLabel}}",
      "{{brochureLink}}",
      "{{brochureBundleHtml}}",
    ],
  },
  courier_address: {
    name: "Courier address request",
    description:
      "Step 2 · Documents: asks the family to share complete delivery details so hard-copy documents can be dispatched.",
    editorTips: [
      "Use this when your team needs the student's shipping address before sending physical documents.",
      "Recommended fields: recipient name, full address, landmark, city, state, pincode, phone, and preferred delivery time.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
    ],
  },
  bank_details: {
    name: "Bank details only",
    description:
      "Step 2 · Documents: sends only the selected bank account details for payment/transfer queries.",
    editorTips: [
      "Use {{feeBankDetailsHtml}} for the bank account block.",
      "No fee summary is included in this template — that remains in the Fee structure template.",
      "If {{feeBankDetailsHtml}} is missing, the app appends bank details automatically.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
      "{{feeBankDetailsHtml}}",
    ],
  },
  fees: {
    name: "Fee structure",
    description:
      "Step 3 · Fees: final fee, scholarship, installments, and bank account for payment. Bank account follows the lead’s selection or your institute default (Bank & A/c Details). Enrollment team BCC when ENROLLMENT_TEAM_BCC is set.",
    editorTips: [
      "Include {{feeSummaryHtml}} for a styled fee block and {{feeBankDetailsHtml}} for the payment account table.",
      "{{feeSummary}} is plain text — use either summary style, not necessarily both.",
      "If {{feeBankDetailsHtml}} is missing from the body, the server appends bank details so students still receive them.",
      "ENROLLMENT_FORM_LINK controls only enrollment emails — fee bank data comes from Bank & A/c Details in the dashboard.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{feeFinal}}",
      "{{feeCurrency}}",
      "{{feeSummary}}",
      "{{feeSummaryHtml}}",
      "{{feeBankDetailsHtml}}",
    ],
  },
  enrollment: {
    name: "Enrollment form",
    description:
      "Sent when sending the enrollment form link. {{enrollmentLink}} is set by ENROLLMENT_FORM_LINK / ENROLLMENT_FORM_URL (see Email Templates SMTP section). Same body for the student (To) and BCC recipients.",
    editorTips: [
      "Set ENROLLMENT_FORM_LINK in .env to your Google Form or page URL; relative paths are resolved with your app URL.",
      "The fee + enrollment bundle (Step 3 button) merges this template with the fee template — edit those two templates to change the combined email.",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{enrollmentLink}}",
    ],
  },
  fees_enrollment_bundle: {
    name: "Fee + enrollment (combined)",
    description:
      "Not a separate DB row — Step 3 · “Send fee + enrollment” builds one email from your Fee + Enrollment templates. BCC enrollment team via ENROLLMENT_TEAM_BCC.",
    editorTips: [
      "Edit the Fee structure and Enrollment form templates above; the bundle does not have its own HTML.",
    ],
    placeholders: [
      "(Edit Fee structure + Enrollment form templates — combined at send time.)",
    ],
  },
  schedule: {
    name: "Class schedule",
    description:
      "Sent from the schedule section on a lead when staff emails the weekly class plan. Uses classes saved on the lead.",
    editorTips: [
      "{{scheduleSummary}} is built from the lead’s saved schedule rows (day, subject, time, teacher, etc.).",
    ],
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{recipientGreeting}}",
      "{{logoUrl}}",
      "{{email}}",
      "{{phone}}",
      "{{scheduleSummary}}",
    ],
  },
};
