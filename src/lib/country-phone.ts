/** Countries for lead forms + phone display (dial codes). */
export type LeadCountryOption = {
  value: string;
  dialCode: string;
  /** Hint for national number field */
  nationalHint: string;
  /** Expected national digit length (inclusive range) */
  nationalLength: { min: number; max: number };
};

export const LEAD_COUNTRY_OPTIONS: LeadCountryOption[] = [
  {
    value: "India",
    dialCode: "+91",
    nationalHint: "10-digit mobile",
    nationalLength: { min: 10, max: 10 },
  },
  {
    value: "UAE",
    dialCode: "+971",
    nationalHint: "9-digit mobile",
    nationalLength: { min: 9, max: 9 },
  },
  {
    value: "Singapore",
    dialCode: "+65",
    nationalHint: "8-digit mobile",
    nationalLength: { min: 8, max: 8 },
  },
  {
    value: "Nepal",
    dialCode: "+977",
    nationalHint: "10-digit mobile",
    nationalLength: { min: 10, max: 10 },
  },
  {
    value: "Saudi Arabia",
    dialCode: "+966",
    nationalHint: "9-digit mobile",
    nationalLength: { min: 9, max: 9 },
  },
  {
    value: "United States",
    dialCode: "+1",
    nationalHint: "10-digit number",
    nationalLength: { min: 10, max: 10 },
  },
  {
    value: "UK",
    dialCode: "+44",
    nationalHint: "10-digit mobile",
    nationalLength: { min: 10, max: 11 },
  },
];

const byCountry = new Map(
  LEAD_COUNTRY_OPTIONS.map((o) => [o.value, o] as const),
);

export function optionForCountry(country: string): LeadCountryOption | undefined {
  return byCountry.get(country.trim());
}

export function dialCodeForCountry(country: string): string {
  return optionForCountry(country)?.dialCode ?? "+91";
}

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Parse a dial code input like "+91" or "91" into normalized "+NN".
 */
export function normalizeDialCodeInput(raw: string): string {
  const d = digitsOnly(raw);
  if (!d) return "+";
  return `+${d}`;
}

export function validateNationalNumber(
  country: string,
  nationalDigits: string,
): string | null {
  const opt = optionForCountry(country);
  if (!nationalDigits) return "Enter the phone number.";
  if (!opt) {
    if (nationalDigits.length < 7 || nationalDigits.length > 15)
      return "Use 7–15 digits for the local number.";
    return null;
  }
  const { min, max } = opt.nationalLength;
  if (nationalDigits.length < min || nationalDigits.length > max) {
    return `Use ${min === max ? `${min}` : `${min}–${max}`} digits (${opt.nationalHint}).`;
  }
  return null;
}

/** Map for quick display lookups */
export const DIAL_BY_COUNTRY: Record<string, string> = Object.fromEntries(
  LEAD_COUNTRY_OPTIONS.map((o) => [o.value, o.dialCode]),
);
