import { docToBankPayload } from "@/lib/bankProfilePayload";
import type { BankAccountRecord } from "@/lib/instituteProfileTypes";
import { normBankAccountId } from "@/lib/instituteProfileTypes";
import type { LeadPipelineMeta } from "@/lib/leadPipelineMetaTypes";
import { escapeHtmlForEmail } from "@/lib/email/buildLeadEmailVars";
import BankProfileSettingsModel from "@/models/BankProfileSettings";
import connectDB from "@/lib/mongodb";

/** Match Fees-step ordering: default account first, then alphabetical. */
function sortActiveAccountsForEmail(
  list: BankAccountRecord[],
  preferredId?: string | null,
): BankAccountRecord[] {
  const active = [...list].filter((a) => a.isActive !== false);
  active.sort((a, b) => {
    const la = (a.label || a.bankName || a.id).toLowerCase();
    const lb = (b.label || b.bankName || b.id).toLowerCase();
    return la.localeCompare(lb);
  });
  const p = normBankAccountId(preferredId);
  if (!p) return active;
  const ix = active.findIndex((a) => normBankAccountId(a.id) === p);
  if (ix <= 0) return active;
  const [chosen] = active.splice(ix, 1);
  return chosen ? [chosen, ...active] : active;
}

const SETTINGS_KEY = "default";

type LeanLead = {
  pipelineMeta?: LeadPipelineMeta | Record<string, unknown> | null;
};

function row(label: string, value: string): string {
  const v = value.trim();
  if (!v) return "";
  return `<tr>
<td style="padding:8px 14px;font-size:12px;color:#616161;width:38%;vertical-align:top;border-bottom:1px solid #eeeeee;">${escapeHtmlForEmail(label)}</td>
<td style="padding:8px 14px;font-size:14px;color:#212121;font-weight:500;vertical-align:top;border-bottom:1px solid #eeeeee;">${escapeHtmlForEmail(v)}</td>
</tr>`;
}

/**
 * Styled block for outbound fee emails (student + BCC). All values HTML-escaped.
 */
export function formatBankAccountEmailHtml(account: BankAccountRecord): string {
  const title = account.label?.trim() || "Fee payment";
  const rows = [
    row("Bank", account.bankName),
    row("Account holder", account.accountHolderName),
    row("Account number", account.accountNumber),
    row("IFSC", account.ifsc),
    row("Branch", account.branch),
    row("Account type", account.accountType),
    row("UPI", account.upi),
  ].filter(Boolean);

  if (rows.length === 0) {
    const title = account.label?.trim() || "Fee payment";
    return `<div style="margin:20px 0 0;padding:14px 16px;border:1px solid #c8e6c9;border-radius:8px;background:#fafafa;max-width:560px;">
<p style="margin:0;font-weight:600;color:#1b5e20;">${escapeHtmlForEmail(title)}</p>
<p style="margin:8px 0 0;font-size:13px;color:#616161;">Complete bank fields are missing in settings — open <strong>Bank &amp; A/c Details</strong> to add them.</p>
</div>`;
  }

  return `<div style="margin:20px 0 0;border:1px solid #c8e6c9;border-radius:8px;overflow:hidden;max-width:560px;">
<div style="background:linear-gradient(180deg,#e8f5e9 0%,#c8e6c9 100%);padding:12px 16px;font-weight:700;font-size:14px;color:#1b5e20;letter-spacing:0.02em;">${escapeHtmlForEmail(title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#fafafa;">
${rows.join("")}
</table>
<p style="margin:10px 16px 14px;font-size:12px;line-height:1.45;color:#616161;">Please use the reference / student name when making the transfer so we can match your payment.</p>
</div>`;
}

/**
 * Resolves which institute bank account to show, matching the Fees step:
 * lead selection if set and active → else institute default for fees → else null.
 * If `feeSelectedBankAccountId` is explicitly `null` on the lead, returns null (family chose “no account”).
 */
export function resolveBankAccountForFeeEmail(
  accounts: BankAccountRecord[],
  defaultFeeBankAccountId: string | null | undefined,
  feeSelectedBankAccountId: string | null | undefined,
  explicitKeyPresent: boolean,
): BankAccountRecord | null {
  const active = accounts.filter((a) => a.isActive !== false);
  const byId = (id: string) => active.find((a) => a.id === id);

  if (explicitKeyPresent && feeSelectedBankAccountId === null) {
    return null;
  }

  const sel = normBankAccountId(feeSelectedBankAccountId);
  if (sel) {
    const a = byId(sel);
    if (a) return a;
  }

  const def = normBankAccountId(defaultFeeBankAccountId);
  if (def) {
    const a = byId(def);
    if (a) return a;
  }

  if (active.length > 0) {
    const sorted = sortActiveAccountsForEmail(active, defaultFeeBankAccountId);
    return sorted[0] ?? null;
  }

  return null;
}

export function feeBankDetailsHtmlForLead(
  lead: LeanLead,
  bankAccounts: BankAccountRecord[],
  defaultFeeBankAccountId: string | null | undefined,
): string {
  const meta = (lead.pipelineMeta ?? {}) as LeadPipelineMeta &
    Record<string, unknown>;
  const fees = meta.fees as LeadPipelineFeesLike | undefined;
  const explicitKeyPresent =
    !!fees && Object.prototype.hasOwnProperty.call(fees, "feeSelectedBankAccountId");

  const acc = resolveBankAccountForFeeEmail(
    bankAccounts,
    defaultFeeBankAccountId,
    fees?.feeSelectedBankAccountId,
    explicitKeyPresent,
  );

  if (!acc) {
    if (explicitKeyPresent && fees?.feeSelectedBankAccountId === null) {
      return `<p style="margin:16px 0 0;font-size:13px;color:#757575;font-style:italic;">No bank account was attached to this fee quote. Reply to this email if you need transfer details.</p>`;
    }
    if (bankAccounts.length === 0) {
      return `<p style="margin:16px 0 0;font-size:13px;color:#757575;">Add bank accounts under <strong>Bank &amp; A/c Details</strong> in the dashboard to include them in fee emails.</p>`;
    }
    return `<p style="margin:16px 0 0;font-size:13px;color:#757575;">No active bank account matched this quote (check the account on the lead or your default under <strong>Bank &amp; A/c Details</strong>).</p>`;
  }

  return formatBankAccountEmailHtml(acc);
}

type LeadPipelineFeesLike = {
  feeSelectedBankAccountId?: string | null;
};

/**
 * Loads bank profile and merges `feeBankDetailsHtml` into fee template vars.
 */
export async function mergeFeeEmailVarsWithBankDetails(
  lead: LeanLead,
  baseVars: Record<string, string>,
): Promise<Record<string, string>> {
  await connectDB();
  const doc = await BankProfileSettingsModel.findOne({ key: SETTINGS_KEY })
    .lean()
    .exec();
  const payload = docToBankPayload(doc ?? {});

  const feeBankDetailsHtml = feeBankDetailsHtmlForLead(
    lead,
    payload.bankAccounts,
    payload.defaultFeeBankAccountId,
  );

  return { ...baseVars, feeBankDetailsHtml };
}

export { ensureFeeBankDetailsInRenderedHtml } from "@/lib/email/templateRenderedEnsures";
