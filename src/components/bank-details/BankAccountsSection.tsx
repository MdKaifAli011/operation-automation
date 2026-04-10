"use client";

import { useId, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { BANK_NAME_SUGGESTIONS } from "@/lib/bankNameSuggestions";
import {
  normBankAccountId,
  type BankAccountRecord,
} from "@/lib/instituteProfileTypes";
import { MAX_BANK_ACCOUNTS } from "@/lib/instituteProfileTypes";
import { randomUuid } from "@/lib/randomUuid";

function maskAccountNumber(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "—";
  if (d.length <= 4) return "····";
  return `····${d.slice(-4)}`;
}

function maskUpi(raw: string): string {
  const t = raw.trim();
  if (!t) return "—";
  if (t.length <= 6) return "····";
  return `${t.slice(0, 3)}···${t.slice(-3)}`;
}

function emptyAccount(): BankAccountRecord {
  return {
    id: randomUuid(),
    label: "",
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    ifsc: "",
    branch: "",
    accountType: "Current",
    upi: "",
    isActive: true,
  };
}

function sortAccounts(list: BankAccountRecord[]): BankAccountRecord[] {
  return [...list].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const la = (a.label || a.bankName || a.id).toLowerCase();
    const lb = (b.label || b.bankName || b.id).toLowerCase();
    return la.localeCompare(lb);
  });
}

export function BankAccountsSection({
  accounts,
  onAccountsChange,
  defaultFeeBankAccountId,
  onDefaultFeeBankAccountIdChange,
  disabled,
}: {
  accounts: BankAccountRecord[];
  onAccountsChange: (next: BankAccountRecord[]) => void;
  defaultFeeBankAccountId: string | null;
  onDefaultFeeBankAccountIdChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const bankNameListId = useId();
  const defaultFeeRadioName = useId();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAcctNo, setShowAcctNo] = useState(false);

  const sorted = useMemo(() => sortAccounts(accounts), [accounts]);
  const defaultFeeNorm = normBankAccountId(defaultFeeBankAccountId);
  const activeCount = useMemo(
    () => accounts.filter((a) => a.isActive).length,
    [accounts],
  );
  const editing = editingId
    ? accounts.find((a) => a.id === editingId) ?? null
    : null;

  const updateEditing = (patch: Partial<BankAccountRecord>) => {
    if (!editingId) return;
    onAccountsChange(
      accounts.map((a) => (a.id === editingId ? { ...a, ...patch } : a)),
    );
  };

  const removeAccount = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Remove this bank account from the saved profile?")
    ) {
      return;
    }
    onAccountsChange(accounts.filter((a) => a.id !== id));
    if (normBankAccountId(defaultFeeBankAccountId) === normBankAccountId(id)) {
      onDefaultFeeBankAccountIdChange(null);
    }
    if (editingId === id) {
      setEditingId(null);
      setShowAcctNo(false);
    }
  };

  const addAccount = () => {
    if (accounts.length >= MAX_BANK_ACCOUNTS) return;
    const next = emptyAccount();
    onAccountsChange([...accounts, next]);
    setEditingId(next.id);
    setShowAcctNo(true);
  };

  const closeEditor = () => {
    setEditingId(null);
    setShowAcctNo(false);
  };

  return (
    <section className="overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
      <div className={SX.sectionHead}>
        <h2 className={SX.sectionTitle}>Bank accounts</h2>
        <span className={SX.leadSectionMeta}>
          Multiple accounts · labels &amp; active status
        </span>
      </div>
      <div className={cn(SX.sectionBody, "space-y-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] leading-relaxed text-[#616161]">
            Saved accounts appear on each student&apos;s Fees step and in ops
            copy. Inactive accounts stay on file but are marked clearly.
          </p>
          <button
            type="button"
            className={SX.btnSecondary}
            disabled={disabled || accounts.length >= MAX_BANK_ACCOUNTS}
            onClick={addAccount}
          >
            Add account
          </button>
        </div>

        {activeCount > 0 ? (
          <div
            className="rounded-none border border-emerald-100 bg-emerald-50/50 px-3 py-3"
            role="group"
            aria-label="Default bank for fee step"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/90">
                  Default account (Fees step)
                </p>
                <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#616161]">
                  Students with no bank picked yet auto-use this account on
                  step 3. Staff can override per lead anytime.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-emerald-100/80 pt-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-none border border-transparent px-0 py-0.5 text-[12px] text-[#212121] hover:border-slate-200/80">
                <input
                  type="radio"
                  name={defaultFeeRadioName}
                  className="h-4 w-4 accent-primary"
                  checked={!defaultFeeNorm}
                  disabled={disabled}
                  onChange={() => onDefaultFeeBankAccountIdChange(null)}
                />
                No institute default — choose manually on each lead
              </label>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[#757575]">
              Select <span className="font-medium text-[#424242]">Use as default</span>{" "}
              on an active account below, then save this page.
            </p>
          </div>
        ) : null}

        {accounts.length === 0 ? (
          <div
            className="rounded-none border border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center"
            role="region"
            aria-label="No bank accounts"
          >
            <p className="text-[13px] font-medium text-slate-800">
              No bank accounts yet
            </p>
            <p className="mt-1 text-[12px] text-slate-600">
              Add one to store settlement details — nothing is shown here until
              you save the page.
            </p>
            <button
              type="button"
              className={cn(SX.btnPrimary, "mt-4")}
              disabled={disabled}
              onClick={addAccount}
            >
              Add first account
            </button>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Bank accounts list">
            {sorted.map((acc) => {
              const title =
                acc.label.trim() ||
                [acc.bankName, acc.accountHolderName]
                  .filter(Boolean)
                  .join(" · ") ||
                "Unlabeled account";
              return (
                <li
                  key={acc.id}
                  className={cn(
                    "rounded-none border border-[#d0d0d0] bg-white p-3 sm:p-4",
                    !acc.isActive && "border-slate-300 bg-slate-50/60 opacity-95",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-[14px] font-semibold text-[#212121]">
                          {title}
                        </h3>
                        <span
                          className={cn(
                            "shrink-0 rounded-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            acc.isActive
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-slate-200 text-slate-700",
                          )}
                        >
                          {acc.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12px] sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">Bank</dt>
                          <dd className="min-w-0 font-medium text-[#212121]">
                            {acc.bankName.trim() || "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">Holder</dt>
                          <dd className="min-w-0 truncate font-medium text-[#212121]">
                            {acc.accountHolderName.trim() || "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">Account</dt>
                          <dd className="font-mono text-[13px] font-medium tabular-nums text-[#212121]">
                            {maskAccountNumber(acc.accountNumber)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">IFSC</dt>
                          <dd className="font-mono text-[13px] font-medium uppercase text-[#212121]">
                            {acc.ifsc.trim() || "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">Branch</dt>
                          <dd className="min-w-0 truncate text-[#212121]">
                            {acc.branch.trim() || "—"}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-[#757575]">Type</dt>
                          <dd className="text-[#212121]">{acc.accountType}</dd>
                        </div>
                        <div className="flex gap-2 sm:col-span-2">
                          <dt className="shrink-0 text-[#757575]">UPI</dt>
                          <dd className="min-w-0 truncate font-mono text-[13px] text-[#212121]">
                            {maskUpi(acc.upi)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {acc.isActive ? (
                        <label className="inline-flex max-w-full cursor-pointer items-center gap-2 text-[11px] font-medium text-[#424242]">
                          <input
                            type="radio"
                            name={defaultFeeRadioName}
                            className="h-4 w-4 shrink-0 accent-primary"
                            checked={defaultFeeNorm === normBankAccountId(acc.id)}
                            disabled={disabled}
                            onChange={() =>
                              onDefaultFeeBankAccountIdChange(
                                normBankAccountId(acc.id) || acc.id,
                              )
                            }
                          />
                          <span className="min-w-0 text-right leading-tight">
                            Use as default
                          </span>
                        </label>
                      ) : null}
                      <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className={SX.btnSecondary}
                        disabled={disabled}
                        onClick={() => {
                          setEditingId(acc.id);
                          setShowAcctNo(false);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={SX.btnSecondary}
                        disabled={disabled}
                        onClick={() =>
                          onAccountsChange(
                            accounts.map((a) =>
                              a.id === acc.id
                                ? { ...a, isActive: !a.isActive }
                                : a,
                            ),
                          )
                        }
                      >
                        {acc.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className={cn(SX.btnSecondary, "text-rose-800")}
                        disabled={disabled}
                        onClick={() => removeAccount(acc.id)}
                      >
                        Remove
                      </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {editing ? (
          <div
            className="rounded-none border-2 border-primary/35 bg-primary/[0.04] p-4"
            role="region"
            aria-label="Edit bank account"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[13px] font-bold text-[#1565c0]">
                Edit account
              </h4>
              <button
                type="button"
                className={SX.btnGhost}
                onClick={closeEditor}
              >
                Close editor
              </button>
            </div>
            <table className={SX.kvTable}>
              <tbody>
                <tr>
                  <th className={SX.kvTh}>Display label</th>
                  <td className={SX.kvTd}>
                    <input
                      className={SX.input}
                      value={editing.label}
                      onChange={(e) =>
                        updateEditing({ label: e.target.value })
                      }
                      placeholder="e.g. Primary · Fee collection (HDFC)"
                      disabled={disabled}
                      aria-label="Account display label"
                    />
                    <p className="mt-1 text-[11px] text-[#757575]">
                      Shown to your team in lists and receipts; not sent to the
                      bank.
                    </p>
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Bank name</th>
                  <td className={SX.kvTd}>
                    <input
                      className={cn(SX.input, "max-w-md")}
                      list={bankNameListId}
                      value={editing.bankName}
                      onChange={(e) =>
                        updateEditing({ bankName: e.target.value })
                      }
                      placeholder="Choose a suggestion or type any bank name"
                      autoComplete="off"
                      disabled={disabled}
                      aria-label="Bank name"
                    />
                    <datalist id={bankNameListId}>
                      {BANK_NAME_SUGGESTIONS.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                    <p className="mt-1 text-[11px] text-[#757575]">
                      Pick from suggestions or enter a custom name (e.g. regional
                      bank).
                    </p>
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Account holder name</th>
                  <td className={SX.kvTd}>
                    <input
                      className={SX.input}
                      value={editing.accountHolderName}
                      onChange={(e) =>
                        updateEditing({ accountHolderName: e.target.value })
                      }
                      placeholder="As per bank records"
                      disabled={disabled}
                    />
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Account number</th>
                  <td className={SX.kvTd}>
                    <div className="flex max-w-md flex-wrap items-stretch gap-2">
                      <input
                        type={showAcctNo ? "text" : "password"}
                        className={SX.input}
                        value={editing.accountNumber}
                        onChange={(e) =>
                          updateEditing({
                            accountNumber: e.target.value.replace(/\s/g, ""),
                          })
                        }
                        placeholder="Account number"
                        autoComplete="off"
                        disabled={disabled}
                        aria-label="Account number"
                      />
                      <button
                        type="button"
                        className={cn(SX.btnSecondary, "shrink-0 px-3")}
                        onClick={() => setShowAcctNo((v) => !v)}
                      >
                        {showAcctNo ? "Hide" : "Show"}
                      </button>
                    </div>
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>IFSC code</th>
                  <td className={SX.kvTd}>
                    <input
                      className={SX.input}
                      value={editing.ifsc}
                      onChange={(e) =>
                        updateEditing({
                          ifsc: e.target.value.toUpperCase(),
                        })
                      }
                      disabled={disabled}
                    />
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Branch name</th>
                  <td className={SX.kvTd}>
                    <input
                      className={SX.input}
                      value={editing.branch}
                      onChange={(e) => updateEditing({ branch: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Account type</th>
                  <td className={SX.kvTd}>
                    <select
                      className={cn(SX.select, "w-full max-w-md")}
                      value={editing.accountType}
                      onChange={(e) =>
                        updateEditing({
                          accountType:
                            e.target.value === "Savings"
                              ? "Savings"
                              : "Current",
                        })
                      }
                      disabled={disabled}
                    >
                      <option value="Current">Current</option>
                      <option value="Savings">Savings</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>UPI ID</th>
                  <td className={SX.kvTd}>
                    <input
                      className={SX.input}
                      value={editing.upi}
                      onChange={(e) => updateEditing({ upi: e.target.value })}
                      disabled={disabled}
                    />
                  </td>
                </tr>
                <tr>
                  <th className={SX.kvTh}>Status</th>
                  <td className={SX.kvTd}>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-[#212121]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={editing.isActive}
                        onChange={(e) =>
                          updateEditing({ isActive: e.target.checked })
                        }
                        disabled={disabled}
                      />
                      Active (use for fee / comms templates)
                    </label>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {accounts.length >= MAX_BANK_ACCOUNTS ? (
          <p className="text-[11px] text-[#757575]">
            Maximum {MAX_BANK_ACCOUNTS} accounts. Remove one to add another.
          </p>
        ) : null}
      </div>
    </section>
  );
}
