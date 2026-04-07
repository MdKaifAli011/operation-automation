export const EMAIL_TEMPLATE_KEYS = [
  "demo_invite",
  "brochure",
  "fees",
  "enrollment",
  "schedule",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export function isEmailTemplateKey(k: string): k is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(k);
}

export const EMAIL_TEMPLATE_META: Record<
  EmailTemplateKey,
  { name: string; description: string; placeholders: string[] }
> = {
  demo_invite: {
    name: "Demo invite",
    description: "Sent when staff taps Share → Send link on a demo row.",
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{email}}",
      "{{phone}}",
      "{{country}}",
      "{{grade}}",
      "{{targetExams}}",
      "{{demoSummary}}",
      "{{meetLink}}",
    ],
  },
  brochure: {
    name: "Brochure",
    description: "Sent from Step 2 when sending the brochure by email.",
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{email}}",
      "{{phone}}",
      "{{brochureLabel}}",
      "{{brochureLink}}",
    ],
  },
  fees: {
    name: "Fee structure",
    description: "Sent when sharing the fee structure by email.",
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{email}}",
      "{{phone}}",
      "{{feeFinal}}",
      "{{feeCurrency}}",
      "{{feeSummary}}",
    ],
  },
  enrollment: {
    name: "Enrollment form",
    description: "Sent when sending the enrollment form link to the family.",
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{email}}",
      "{{phone}}",
      "{{enrollmentLink}}",
    ],
  },
  schedule: {
    name: "Class schedule",
    description: "Sent when sharing the weekly class schedule by email.",
    placeholders: [
      "{{studentName}}",
      "{{parentName}}",
      "{{email}}",
      "{{phone}}",
      "{{scheduleSummary}}",
    ],
  },
};
