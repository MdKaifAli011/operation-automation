import { dialCodeForCountry } from "./country-phone";
import type { Lead } from "./types";

/** Display phone with a plausible dial code from country (CRM-style). */
export function formatLeadPhone(lead: Lead): string {
  const dial = dialCodeForCountry(lead.country);
  const digits = lead.phone.replace(/\D/g, "");
  if (!digits) return `${dial} —`;
  return `${dial} ${digits}`;
}

/** `tel:` link in E.164-style using stored country + national digits. */
export function telHrefForLead(lead: Lead): string {
  const cc = dialCodeForCountry(lead.country).replace(/\D/g, "");
  const national = lead.phone.replace(/\D/g, "");
  if (!national) return "";
  return `tel:+${cc}${national}`;
}
