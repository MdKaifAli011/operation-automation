import { INITIAL_LEADS } from "./mock-data";
import type { Lead } from "./types";

export function getLeadById(id: string): Lead | undefined {
  return INITIAL_LEADS.find((l) => l.id === id);
}

export type StudentDetailExtras = {
  country: string;
  email: string;
  statusLabel: string;
};

export function extrasForLead(lead: Lead): StudentDetailExtras {
  return {
    country: lead.country,
    email: `${lead.studentName.split(" ")[0].toLowerCase()}@email.test`,
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
