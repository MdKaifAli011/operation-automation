import {
  MAX_BANK_ACCOUNTS,
  normBankAccountId,
  type BankAccountRecord,
  type BankProfilePayload,
} from "@/lib/instituteProfileTypes";

function str(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

export function parseBankAccount(raw: unknown): BankAccountRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = normBankAccountId(o.id);
  if (!id) return null;
  const accountType =
    o.accountType === "Savings" ? "Savings" : "Current";
  return {
    id,
    label: str(o.label, 120),
    bankName: str(o.bankName, 120),
    accountHolderName: str(o.accountHolderName, 120),
    accountNumber: str(o.accountNumber, 40).replace(/\s+/g, ""),
    ifsc: str(o.ifsc, 20).toUpperCase(),
    branch: str(o.branch, 120),
    accountType,
    upi: str(o.upi, 120),
    isActive: o.isActive !== false,
  };
}

export function docToBankPayload(doc: {
  bankAccounts?: unknown;
  defaultFeeBankAccountId?: unknown;
}): BankProfilePayload {
  const bankAccounts = Array.isArray(doc.bankAccounts)
    ? doc.bankAccounts
        .map((row) => parseBankAccount(row))
        .filter((x): x is BankAccountRecord => x !== null)
    : [];
  let defaultFeeBankAccountId: string | null =
    normBankAccountId(doc.defaultFeeBankAccountId) || null;
  if (defaultFeeBankAccountId) {
    const hit = bankAccounts.find(
      (a) =>
        normBankAccountId(a.id) === defaultFeeBankAccountId && a.isActive,
    );
    defaultFeeBankAccountId = hit ? normBankAccountId(hit.id) || null : null;
  }
  return { bankAccounts, defaultFeeBankAccountId };
}

export function parseBankPutBody(body: unknown):
  | { ok: true; data: BankProfilePayload }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid JSON body." };
  }
  const b = body as Record<string, unknown>;
  const rawAccounts = b.bankAccounts;
  if (rawAccounts !== undefined && !Array.isArray(rawAccounts)) {
    return { ok: false, error: "bankAccounts must be an array." };
  }
  const bankAccounts: BankAccountRecord[] = [];
  const seen = new Set<string>();
  if (Array.isArray(rawAccounts)) {
    for (const row of rawAccounts) {
      const acc = parseBankAccount(row);
      if (!acc) continue;
      if (seen.has(acc.id)) continue;
      seen.add(acc.id);
      bankAccounts.push(acc);
    }
  }
  if (bankAccounts.length > MAX_BANK_ACCOUNTS) {
    return {
      ok: false,
      error: `At most ${MAX_BANK_ACCOUNTS} bank accounts allowed.`,
    };
  }
  let defaultFeeBankAccountId: string | null =
    normBankAccountId(b.defaultFeeBankAccountId) || null;
  if (defaultFeeBankAccountId) {
    const hit = bankAccounts.find(
      (a) =>
        normBankAccountId(a.id) === defaultFeeBankAccountId && a.isActive,
    );
    defaultFeeBankAccountId = hit ? normBankAccountId(hit.id) || null : null;
  }
  return {
    ok: true,
    data: { bankAccounts, defaultFeeBankAccountId },
  };
}
