/**
 * Short labels for lead channel / data type (Ongoing sheet picker).
 * Stored values remain full names (Organic, Walk-in, …) for CSV/API compatibility.
 */
export const DATA_TYPE_PICK_OPTIONS = [
  { abbrev: "OL", value: "Organic" },
  { abbrev: "WT", value: "Walk-in" },
  { abbrev: "REF", value: "Referral" },
  { abbrev: "PD", value: "Paid" },
] as const;

export function dataTypeToShortLabel(dataType: string): string {
  const t = dataType.trim();
  if (t === "Organic") return "OL";
  if (t === "Walk-in") return "WT";
  if (t === "Referral") return "REF";
  if (t === "Paid") return "PD";
  if (t === "Partner") return "PT";
  if (!t) return "—";
  return t.length <= 4 ? t : `${t.slice(0, 3)}…`;
}
