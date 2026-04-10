/**
 * Lead source / channel options (stored on `Lead.dataType`).
 * Defaults match the lead sheet abbreviations; full list is configurable in Settings.
 */

export type LeadSourceOption = {
  /** Short code shown in the grid (e.g. OL). */
  abbrev: string;
  /** Display name in forms (e.g. Organic). */
  label: string;
  /** Value persisted on the lead (e.g. Organic, Whatsapp). */
  value: string;
};

/** Default when DB has no settings document yet. */
export const DEFAULT_LEAD_SOURCE_OPTIONS: LeadSourceOption[] = [
  { abbrev: "OL", label: "Organic", value: "Organic" },
  { abbrev: "WT", label: "Whatsapp", value: "Whatsapp" },
  { abbrev: "REF", label: "Reference", value: "Reference" },
  { abbrev: "PD", label: "Paid", value: "Paid" },
];

const MAX_SOURCES = 24;

function trimStr(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

/** Normalize API/DB payload into a valid non-empty list (falls back to defaults). */
export function normalizeLeadSources(
  raw: unknown,
): LeadSourceOption[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_LEAD_SOURCE_OPTIONS.map((o) => ({ ...o }));
  }
  const out: LeadSourceOption[] = [];
  const seenAbbrev = new Set<string>();
  const seenValue = new Set<string>();
  for (const row of raw) {
    if (out.length >= MAX_SOURCES) break;
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const abbrev = trimStr(r.abbrev, 8).toUpperCase();
    const label = trimStr(r.label, 64);
    const value = trimStr(r.value, 64);
    if (!abbrev || !label || !value) continue;
    const keyA = abbrev.toLowerCase();
    const keyV = value.toLowerCase();
    if (seenAbbrev.has(keyA) || seenValue.has(keyV)) continue;
    seenAbbrev.add(keyA);
    seenValue.add(keyV);
    out.push({ abbrev, label, value });
  }
  return out.length > 0 ? out : DEFAULT_LEAD_SOURCE_OPTIONS.map((o) => ({ ...o }));
}

/** Map stored `dataType` to abbrev for the grid; uses configured sources + legacy values. */
export function dataTypeToShortLabel(
  dataType: string,
  options: LeadSourceOption[] = DEFAULT_LEAD_SOURCE_OPTIONS,
): string {
  const t = dataType.trim();
  if (!t) return "—";
  const match = options.find((o) => o.value === t);
  if (match) return match.abbrev;
  const legacyAbbrev: Record<string, string> = {
    Organic: "OL",
    Whatsapp: "WT",
    "Walk-in": "WT",
    Referral: "REF",
    Reference: "REF",
    Paid: "PD",
    Partner: "PT",
  };
  if (legacyAbbrev[t]) return legacyAbbrev[t]!;
  return t.length <= 4 ? t : `${t.slice(0, 3)}…`;
}
