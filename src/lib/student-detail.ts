import type { Lead } from "./types";

export type StudentDetailExtras = {
  country: string;
  email: string;
  statusLabel: string;
};

export function extrasForLead(lead: Lead): StudentDetailExtras {
  const derivedEmail = `${(lead.studentName.split(" ")[0] ?? "student").toLowerCase()}@email.test`;
  return {
    country: lead.country,
    email: lead.email?.trim() || derivedEmail,
    statusLabel:
      lead.rowTone === "new"
        ? "New"
        : lead.rowTone === "interested"
          ? "Interested"
          : lead.rowTone === "not_interested"
            ? "Not Interested"
            : lead.rowTone === "followup_later"
              ? "Follow-up Later"
              : "Called / No Response",
  };
}
