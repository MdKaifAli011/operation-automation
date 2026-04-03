import type { RowTone } from "@/lib/types";

export function rowToneBg(tone: RowTone): string {
  switch (tone) {
    case "interested":
      return "bg-[#e8f5e9]";
    case "not_interested":
      return "bg-[#ffebee]";
    case "followup_later":
      return "bg-[#fffde7]";
    case "new":
      return "bg-[#e3f2fd]";
    case "called_no_response":
      return "bg-[#f5f5f5]";
    default:
      return "bg-white";
  }
}
