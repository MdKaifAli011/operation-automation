import type { Lead } from "./types";

const DIAL_BY_COUNTRY: Record<string, string> = {
  India: "+91",
  UAE: "+971",
  Singapore: "+65",
  Nepal: "+977",
  "United States": "+1",
  UK: "+44",
};

/** Display phone with a plausible dial code from country (CRM-style). */
export function formatLeadPhone(lead: Lead): string {
  const dial = DIAL_BY_COUNTRY[lead.country] ?? "+91";
  const digits = lead.phone.replace(/\D/g, "");
  if (!digits) return `${dial} —`;
  return `${dial} ${digits}`;
}
