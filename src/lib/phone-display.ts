import { dialCodeForCountry } from "./country-phone";
import type { Lead } from "./types";

/** Display phone with a plausible dial code from country (CRM-style). */
export function formatLeadPhone(lead: Lead): string {
  const dial = dialCodeForCountry(lead.country);
  const digits = lead.phone.replace(/\D/g, "");
  if (!digits) return `${dial} —`;
  return `${dial} ${digits}`;
}
