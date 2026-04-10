import type { EmailTemplateKey } from "@/lib/email/templateKeys";

/** Neutral placeholders for preview only — real sends use data from each lead. */
export function getPreviewSampleVars(key: EmailTemplateKey): Record<string, string> {
  const base: Record<string, string> = {
    studentName: "Student name",
    parentName: "Parent / guardian name",
    email: "email@address",
    phone: "Phone number",
    country: "Country",
    grade: "Class / grade",
    targetExams: "Target exam(s)",
  };

  switch (key) {
    case "demo_invite":
      return {
        ...base,
        demoSummary: "Subject · Teacher · Date · Time (timezone)",
        meetLink: "https://…",
      };
    case "brochure":
      return {
        ...base,
        brochureLabel: "Brochure title",
        brochureLink: "https://…",
      };
    case "fees": {
      const feeSummary = [
        "Final fee: (amount)",
        "Scholarship: (if any)",
        "Installments: (count)",
        "  1. (amount) · due (date)",
      ].join("\n");
      return {
        ...base,
        feeFinal: "(amount)",
        feeCurrency: "INR",
        feeSummary,
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
