/** Shared shape for institute profile (bank-details page + API). */

export type BankAccountRecord = {
  id: string;
  /** Ops-facing name, e.g. "Main · HDFC fee collection" */
  label: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: "Current" | "Savings";
  upi: string;
  isActive: boolean;
};

export type InstituteRecord = {
  instituteName: string;
  regNo: string;
  gst: string;
  /** GST % applied for NRO / India tax-inclusive quotes (fee step preview). */
  feeGstPercent: number;
  /** How many INR equal 1 USD (e.g. 83). Used to convert ₹ ↔ USD in fee previews. */
  inrPerUsd: number;
  /** How many INR equal 1 AED (e.g. 22.5). */
  inrPerAed: number;
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
};

/** Legal / contact institute fields only (`institute_profile_settings`). */
export type InstituteProfilePayload = {
  institute: InstituteRecord;
};

/** Bank accounts + fee default (`bank_profile_settings`). */
export type BankProfilePayload = {
  bankAccounts: BankAccountRecord[];
  /** Pre-selected on each lead’s Fees step when none is saved yet (active account id). */
  defaultFeeBankAccountId: string | null;
};

export const DEFAULT_INSTITUTE: InstituteRecord = {
  instituteName: "",
  regNo: "",
  gst: "",
  feeGstPercent: 18,
  inrPerUsd: 83,
  inrPerAed: 22.5,
  address: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
  phone: "",
  email: "",
  website: "",
};

export const MAX_BANK_ACCOUNTS = 30;

/** Normalize account ids for comparisons and API (trim, max 64). */
export function normBankAccountId(id: unknown): string {
  if (id == null) return "";
  return String(id).trim().slice(0, 64);
}
