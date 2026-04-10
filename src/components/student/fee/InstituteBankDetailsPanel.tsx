"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BankAccountRecord } from "@/lib/instituteProfileTypes";

/**
 * Fees step: show only configured bank names (no account numbers or IFSC).
 */
export function InstituteBankDetailsPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BankAccountRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void fetch("/api/settings/institute-profile", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string" ? data.error : "Load failed",
          );
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const raw = data.bankAccounts;
        const list = Array.isArray(raw) ? (raw as BankAccountRecord[]) : [];
        setAccounts(list);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setErr(
            e instanceof Error ? e.message : "Could not load bank details.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bankNames = useMemo(() => {
    const names = accounts
      .filter((a) => a.isActive)
      .map((a) => a.bankName.trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [accounts]);

  const hasActiveAccounts = useMemo(
    () => accounts.some((a) => a.isActive),
    [accounts],
  );

  if (loading) {
    return (
      <div className="mt-3 mb-0 rounded-none border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] text-slate-600">
        Loading bank names…
      </div>
    );
  }

  if (err) {
    return (
      <div
        className="mt-3 mb-0 rounded-none border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900"
        role="alert"
      >
        {err}
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

  if (bankNames.length === 0) {
    return (
      <div className="mt-3 mb-0 rounded-none border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm shadow-slate-900/[0.02]">
        <p className="font-medium text-slate-900">Bank names</p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Active accounts have no bank name filled — add names in{" "}
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

  return (
    <div className="mt-3 mb-0 overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-1.5">
        <h3 className="text-[12px] font-semibold text-slate-900">Bank names</h3>
        <p className="text-[10px] leading-tight text-slate-600">
          From active accounts ·{" "}
          <Link
            href="/bank-details"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Edit in Bank &amp; A/c Details
          </Link>
        </p>
      </div>
      <ul
        className="divide-y divide-slate-100 px-3 py-0 text-[13px] text-slate-900"
        aria-label="Bank names for fees"
      >
        {bankNames.map((name) => (
          <li key={name} className="py-1.5">
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
