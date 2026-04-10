"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  normBankAccountId,
  type BankAccountRecord,
} from "@/lib/instituteProfileTypes";

function normId(id: string | null | undefined): string {
  return normBankAccountId(id);
}

function sortActiveAccounts(
  list: BankAccountRecord[],
  preferredId?: string | null,
): BankAccountRecord[] {
  const active = [...list].filter((a) => a.isActive);
  active.sort((a, b) => {
    const la = (a.label || a.bankName || a.id).toLowerCase();
    const lb = (b.label || b.bankName || b.id).toLowerCase();
    return la.localeCompare(lb);
  });
  const p = normId(preferredId);
  if (!p) return active;
  const ix = active.findIndex((a) => normId(a.id) === p);
  if (ix <= 0) return active;
  const [chosen] = active.splice(ix, 1);
  return chosen ? [chosen, ...active] : active;
}

function accountOptionLabel(a: BankAccountRecord): string {
  const bank = a.bankName.trim();
  const lab = a.label.trim();
  if (lab && bank) return `${lab} · ${bank}`;
  if (bank) return bank;
  if (lab) return lab;
  return "Account (add bank name)";
}

type Props = {
  leadId: string;
  /** Saved institute bank account id from `pipelineMeta.fees`. */
  value: string | null;
  /** `sync` = applying institute default programmatically (don’t mark “user cleared”). */
  onChange: (
    accountId: string | null,
    source?: "user" | "sync",
  ) => void;
};

/** Fees step: bank account for this lead (saved on the lead). */
export function InstituteBankDetailsPanel({ leadId, value, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccountRecord[]>([]);
  const [defaultFeeBankAccountId, setDefaultFeeBankAccountId] = useState<
    string | null
  >(null);
  /** User explicitly chose “no account” in the dropdown — do not re-apply institute default. */
  const [userChoseNoBank, setUserChoseNoBank] = useState(false);

  useEffect(() => {
    setUserChoseNoBank(false);
  }, [leadId]);

  const loadProfile = useCallback(async (mode: "full" | "refresh" = "full") => {
    if (mode === "full") {
      setLoading(true);
      setErr(null);
    }
    try {
      const res = await fetch("/api/settings/bank-profile", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Load failed",
        );
      }
      const raw = data.bankAccounts;
      const list = Array.isArray(raw) ? (raw as BankAccountRecord[]) : [];
      setAccounts(list);
      const rawDef = data.defaultFeeBankAccountId;
      setDefaultFeeBankAccountId(normBankAccountId(rawDef) || null);
    } catch (e: unknown) {
      if (mode === "full") {
        setErr(
          e instanceof Error ? e.message : "Could not load bank details.",
        );
      }
    } finally {
      if (mode === "full") setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile("full");
  }, [loadProfile, leadId]);

  useEffect(() => {
    const onFocus = () => void loadProfile("refresh");
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadProfile]);

  const activeSorted = useMemo(
    () => sortActiveAccounts(accounts, defaultFeeBankAccountId),
    [accounts, defaultFeeBankAccountId],
  );

  const defNorm = normId(defaultFeeBankAccountId);
  const valueNorm = normId(value);

  /** What the dropdown shows: saved id, else institute default, else empty. */
  const resolvedSelectId = useMemo(() => {
    if (userChoseNoBank && !valueNorm) return "";
    if (valueNorm && activeSorted.some((a) => normId(a.id) === valueNorm)) {
      return valueNorm;
    }
    if (!userChoseNoBank && defNorm && activeSorted.some((a) => normId(a.id) === defNorm)) {
      return defNorm;
    }
    return "";
  }, [userChoseNoBank, valueNorm, defNorm, activeSorted]);

  const hasActiveAccounts = activeSorted.length > 0;

  useEffect(() => {
    if (loading) return;
    if (userChoseNoBank) return;
    const v = valueNorm;
    const inList = v.length > 0 && activeSorted.some((a) => normId(a.id) === v);
    if (inList) return;
    if (!defNorm) return;
    if (!activeSorted.some((a) => normId(a.id) === defNorm)) return;
    onChange(defNorm, "sync");
  }, [
    loading,
    userChoseNoBank,
    valueNorm,
    defNorm,
    activeSorted,
    onChange,
  ]);

  const handleSelectChange = (raw: string) => {
    const id = normId(raw) || null;
    if (!id) {
      setUserChoseNoBank(true);
      onChange(null, "user");
    } else {
      setUserChoseNoBank(false);
      onChange(id, "user");
    }
  };

  if (loading) {
    return (
      <div className="mt-3 mb-0 rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600">
        Loading bank accounts…
      </div>
    );
  }

  if (err) {
    return (
      <div
        className="mt-3 mb-0 rounded-none border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900"
        role="alert"
      >
        {err}{" "}
        <button
          type="button"
          className="font-semibold underline"
          onClick={() => void loadProfile("full")}
        >
          Retry
        </button>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="mt-3 mb-0 rounded-none border border-dashed border-amber-200 bg-amber-50/80 px-3 py-2 text-[12px] text-amber-950">
        <p className="font-medium">No bank accounts on file.</p>
        <p className="mt-0.5 text-[11px] text-amber-900/90">
          Add them under{" "}
          <Link
            href="/bank-details"
            className="font-semibold text-primary underline underline-offset-2"
          >
            Bank &amp; A/c Details
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!hasActiveAccounts) {
    return (
      <div className="mt-3 mb-0 rounded-none border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-950">
        No <strong>active</strong> bank accounts — activate one under{" "}
        <Link
          href="/bank-details"
          className="font-semibold text-primary underline underline-offset-2"
        >
          Bank &amp; A/c Details
        </Link>
        .
      </div>
    );
  }

  const valueMismatch =
    valueNorm &&
    !activeSorted.some((a) => normId(a.id) === valueNorm);

  return (
    <div className="mt-3 mb-0 overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-1.5">
        <h3 className="text-[12px] font-semibold text-slate-900">
          Bank for fee payment
        </h3>
      </div>
      <div className="px-3 py-2">
        <label
          htmlFor="fee-bank-account-select"
          className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Bank account
        </label>
        <select
          id="fee-bank-account-select"
          className={cn(SX.select, "mt-1 w-full max-w-lg")}
          value={resolvedSelectId}
          onChange={(e) => handleSelectChange(e.target.value)}
          aria-label="Bank account for fee payment"
        >
          <option value="">
            {defNorm ? "No bank on this fee (override default)" : "Select bank account…"}
          </option>
          {activeSorted.map((a) => {
            const id = normId(a.id);
            const isDef = defNorm === id;
            return (
              <option key={id} value={id}>
                {accountOptionLabel(a)}
                {isDef ? " · Default" : ""}
              </option>
            );
          })}
        </select>

        {valueMismatch ? (
          <p className="mt-1.5 text-[11px] text-amber-800" role="status">
            Previously selected account was removed or deactivated — pick
            another.
          </p>
        ) : null}
      </div>
    </div>
  );
}
