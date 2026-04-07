/** Curated fallback if `Intl.supportedValuesOf` is unavailable (older runtimes). */
const FALLBACK_IANA_TIME_ZONES: readonly string[] = [
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Colombo",
  "Asia/Dhaka",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Riyadh",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Moscow",
  "Europe/Paris",
  "Pacific/Auckland",
  "UTC",
] as const;

function dedupeSorted(zones: string[]): string[] {
  return [...new Set(zones)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/**
 * All IANA time zones supported by the runtime (browser or Node 20+), sorted.
 */
export function listIanaTimeZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
    ).supportedValuesOf;
    if (typeof supported === "function") {
      const list = supported.call(Intl, "timeZone");
      if (Array.isArray(list) && list.length > 0) {
        return dedupeSorted(list);
      }
    }
  } catch {
    /* ignore */
  }
  return dedupeSorted([...FALLBACK_IANA_TIME_ZONES]);
}

/** Region segment for `<optgroup>` (e.g. `Europe` from `Europe/Berlin`). */
export function ianaTimeZoneGroup(tz: string): string {
  const i = tz.indexOf("/");
  if (i === -1) return "Other";
  return tz.slice(0, i);
}

const GROUP_ORDER = [
  "Africa",
  "America",
  "Antarctica",
  "Arctic",
  "Asia",
  "Atlantic",
  "Australia",
  "Europe",
  "Indian",
  "Pacific",
  "Etc",
  "UTC",
];

function groupSortKey(g: string): number {
  const idx = GROUP_ORDER.indexOf(g);
  return idx === -1 ? 999 : idx;
}

export type GroupedTimeZoneOption = {
  value: string;
  label: string;
  group: string;
};

function formatOffsetPart(tz: string, ref: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(ref);
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (name) return name;
  } catch {
    /* ignore */
  }
  try {
    const parts = new Intl.DateTimeFormat("en-IN", {
      timeZone: tz,
      timeZoneName: "short",
    }).formatToParts(ref);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

/** Human-readable row for `<option>`: `New York (GMT-5)` */
export function formatTimeZoneSelectLabel(tz: string, refDate: Date = new Date()): string {
  const tail =
    tz.includes("/") ? tz.split("/").slice(1).join("/").replace(/_/g, " ") : tz;
  const off = formatOffsetPart(tz, refDate);
  return off ? `${tail} (${off})` : tail;
}

let cachedGrouped: GroupedTimeZoneOption[] | null = null;

export function getGroupedTimeZoneSelectOptions(): GroupedTimeZoneOption[] {
  if (cachedGrouped) return cachedGrouped;
  const ref = new Date();
  const zones = listIanaTimeZones();
  const rows: GroupedTimeZoneOption[] = zones.map((value) => ({
    value,
    label: formatTimeZoneSelectLabel(value, ref),
    group: ianaTimeZoneGroup(value),
  }));
  rows.sort((a, b) => {
    const ga = groupSortKey(a.group);
    const gb = groupSortKey(b.group);
    if (ga !== gb) return ga - gb;
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    return a.label.localeCompare(b.label);
  });
  cachedGrouped = rows;
  return rows;
}

/** If `value` is not in the catalog (legacy row), prepend a single "Current value" option. */
export function ensureSelectedTimeZoneOption(
  value: string,
  options: GroupedTimeZoneOption[],
): GroupedTimeZoneOption[] {
  const v = value.trim();
  if (!v) return options;
  if (options.some((o) => o.value === v)) return options;
  const ref = new Date();
  return [
    {
      group: "Current value",
      value: v,
      label: formatTimeZoneSelectLabel(v, ref),
    },
    ...options,
  ];
}

/** Short label for past-slot warnings (offset or city). */
export function timeZoneShortLabelForMessages(
  tz: string,
  refDate: Date = new Date(),
): string {
  const off = formatOffsetPart(tz, refDate);
  if (off) return off;
  if (tz.includes("/")) {
    return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  }
  return tz;
}
