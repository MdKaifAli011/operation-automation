import type { Lead, RowTone } from "@/lib/types";

/** Student name link color aligned to row status (reference UI). */
export function rowToneNameLinkClass(tone: RowTone): string {
  switch (tone) {
    case "interested":
      return "text-emerald-700 decoration-emerald-600/35";
    case "not_interested":
      return "text-rose-700 decoration-rose-500/35";
    case "followup_later":
      return "text-amber-800 decoration-amber-600/35";
    case "new":
      return "text-sky-800 decoration-sky-600/35";
    case "called_no_response":
      return "text-slate-700 decoration-slate-400";
    default:
      return "text-primary decoration-primary/30";
  }
}

export function rowToneBg(tone: RowTone): string {
  switch (tone) {
    case "interested":
      return "bg-emerald-50/90";
    case "not_interested":
      return "bg-rose-50/90";
    case "followup_later":
      return "bg-amber-50/90";
    case "new":
      return "bg-sky-50/90";
    case "called_no_response":
      return "bg-slate-100/90";
    default:
      return "bg-white";
  }
}

/** Returns orange background for leads with follow-up dates, otherwise uses rowToneBg. */
export function rowToneBgWithFollowUp(lead: Lead): string {
  if (lead.followUpDate?.trim()) {
    return "bg-orange-50/90";
  }
  return rowToneBg(lead.rowTone);
}
