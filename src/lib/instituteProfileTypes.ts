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
  address: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
};

export type InstituteProfilePayload = {
  institute: InstituteRecord;
  bankAccounts: BankAccountRecord[];
};

export const DEFAULT_INSTITUTE: InstituteRecord = {
  instituteName: "",
  regNo: "",
  gst: "",
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
