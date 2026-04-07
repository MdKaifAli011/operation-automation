import type { EmailTemplateKey } from "@/lib/email/templateKeys";

/** Realistic sample values — same keys as server `buildLeadEmailVars` may fill. */
export function getPreviewSampleVars(key: EmailTemplateKey): Record<string, string> {
  const base: Record<string, string> = {
    studentName: "Aarav Sharma",
    parentName: "Mrs. Priya Sharma",
    email: "parent@example.com",
    phone: "+91 98765 43210",
    country: "India",
    grade: "12th",
    targetExams: "NEET, Boards",
  };

  switch (key) {
    case "demo_invite":
      return {
        ...base,
        demoSummary:
          "Physics · Dr. Ravi Kumar · 12 Apr 2026 · 4:00 pm IST",
      };
    case "brochure":
      return {
        ...base,
        brochureLabel: "NEET 2026 — Course brochure",
        brochureLink: "https://example.com/files/neet-brochure.pdf",
      };
    case "fees": {
      const feeSummary = [
        "Final fee: ₹1,85,000",
        "Scholarship: 10%",
        "Installments: 3",
        "  1. ₹62,000 · due 2026-05-01",
        "  2. ₹61,500 · due 2026-06-01",
        "  3. ₹61,500 · due 2026-07-01",
      ].join("\n");
      return {
        ...base,
        feeFinal: "₹1,85,000",
        feeCurrency: "INR",
        feeSummary,
      };
    }
    case "enrollment":
      return {
        ...base,
        enrollmentLink: "https://example.com/enroll-student",
      };
    case "schedule":
      return {
        ...base,
        scheduleSummary: [
          "Monday · Physics · IST 4:00 pm · Dr. Ravi · 1 hr",
          "Wednesday · Chemistry · IST 5:00 pm · Dr. Meena · 1 hr",
          "Friday · Biology · IST 4:30 pm · Dr. Anil · 1 hr",
        ].join("\n"),
      };
    default:
      return base;
  }
}
