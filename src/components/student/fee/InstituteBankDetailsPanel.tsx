"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import type { BankAccountRecord } from "@/lib/instituteProfileTypes";

function sortFeeBankAccounts(list: BankAccountRecord[]): BankAccountRecord[] {
  return [...list].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const la = (a.label || a.bankName || a.id).toLowerCase();
    const lb = (b.label || b.bankName || b.id).toLowerCase();
    return la.localeCompare(lb);
  });
}

function optionLabel(a: BankAccountRecord): string {
  const base =
    a.label.trim() ||
    [a.bankName, a.accountHolderName].filter(Boolean).join(" · ") ||
    `Account ${a.id.slice(0, 8)}…`;
  return a.isActive ? base : `${base} (inactive)`;
}

function maskAccountDigits(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d) return "—";
  if (d.length <= 4) return "····";
  return `····${d.slice(-4)}`;
}

function buildPaymentCopy(
  a: BankAccountRecord,
  instituteName?: string,
): string {
  const lines = [
    instituteName?.trim() ? `Institute: ${instituteName.trim()}` : null,
    a.bankName.trim() ? `Bank: ${a.bankName.trim()}` : null,
    a.accountHolderName.trim()
      ? `Account name: ${a.accountHolderName.trim()}`
      : null,
    a.accountNumber.trim() ? `Account no.: ${a.accountNumber.trim()}` : null,
    a.ifsc.trim() ? `IFSC: ${a.ifsc.trim()}` : null,
    a.branch.trim() ? `Branch: ${a.branch.trim()}` : null,
    `Account type: ${a.accountType}`,
    a.upi.trim() ? `UPI: ${a.upi.trim()}` : null,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

export function InstituteBankDetailsPanel() {
  const selectId = useId();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [instituteName, setInstituteName] = useState("");
  const [accounts, setAccounts] = useState<BankAccountRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAcct, setShowAcct] = useState(false);
  const [copyHint, setCopyHint] = useState<string | null>(null);

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
        const inst = data.institute;
        if (inst && typeof inst === "object" && !Array.isArray(inst)) {
          setInstituteName(
            String(
              (inst as { instituteName?: string }).instituteName ?? "",
            ).trim(),
          );
        } else {
          setInstituteName("");
        }
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

  const sorted = useMemo(() => sortFeeBankAccounts(accounts), [accounts]);

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null);
      return;
    }
    const order = sortFeeBankAccounts(accounts);
    setSelectedId((prev) =>
      prev && order.some((a) => a.id === prev) ? prev : order[0]!.id,
    );
  }, [accounts]);

  const selected =
    sorted.find((a) => a.id === selectedId) ?? sorted[0] ?? null;

  const onCopy = async () => {
    if (!selected) return;
    const ok = await copyTextToClipboard(
      buildPaymentCopy(selected, instituteName),
    );
    setCopyHint(
      ok ? "Copied to clipboard." : "Copy failed — select text manually.",
    );
    window.setTimeout(() => setCopyHint(null), 2500);
  };

  if (loading) {
    return (
      <div className="mb-4 rounded-none border border-slate-200 bg-slate-50/80 px-4 py-3 text-[13px] text-slate-600">
        Loading bank details…
      </div>
    );
  }

  if (err) {
    return (
      <div
        className="mb-4 rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900"
        role="alert"
      >
        {err}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="mb-4 rounded-none border border-dashed border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-950">
        <p className="font-medium">No bank accounts on file.</p>
        <p className="mt-1 text-[12px] text-amber-900/90">
          Add accounts under{" "}
          <Link
            href="/bank-details"
            className="font-semibold text-primary underline underline-offset-2"
          >
            Bank &amp; A/c Details
          </Link>{" "}
          — they will appear here for fee collection and messaging.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-900">
            Bank transfer details
          </h3>
          <p className="text-[11px] text-slate-600">
            From{" "}
            <span className="font-medium">Bank &amp; A/c Details</span> · share
            with parents for payment
          </p>
        </div>
        <button
          type="button"
          className={cn(SX.btnSecondary, "shrink-0 text-[12px]")}
          onClick={() => void onCopy()}
        >
          Copy all
        </button>
      </div>
      <div className="p-3 sm:p-4">
        {sorted.length > 1 ? (
          <label className="mb-3 block text-[12px] font-medium text-slate-700">
            <span className="mb-1 block">Which account to show</span>
            <select
              id={selectId}
              className={cn(SX.select, "w-full max-w-md")}
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
            >
              {sorted.map((a) => (
                <option key={a.id} value={a.id}>
                  {optionLabel(a)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {selected ? (
          <dl className="grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Label
              </dt>
              <dd className="font-medium text-slate-900">
                {selected.label.trim() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Bank
              </dt>
              <dd className="text-slate-900">
                {selected.bankName.trim() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Account holder
              </dt>
              <dd className="text-slate-900">
                {selected.accountHolderName.trim() || "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Account number
              </dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums text-slate-900">
                  {showAcct
                    ? selected.accountNumber.trim() || "—"
                    : maskAccountDigits(selected.accountNumber)}
                </span>
                <button
                  type="button"
                  className={cn(SX.btnSecondary, "px-2 py-1 text-[11px]")}
                  onClick={() => setShowAcct((v) => !v)}
                >
                  {showAcct ? "Hide" : "Show"}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                IFSC
              </dt>
              <dd className="font-mono uppercase text-slate-900">
                {selected.ifsc.trim() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Branch
              </dt>
              <dd className="text-slate-900">
                {selected.branch.trim() || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Type
              </dt>
              <dd className="text-slate-900">{selected.accountType}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                UPI
              </dt>
              <dd className="font-mono text-slate-900">
                {selected.upi.trim() || "—"}
              </dd>
            </div>
            {!selected.isActive ? (
              <div className="sm:col-span-2 rounded-none border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-950">
                This account is marked <strong>inactive</strong> in settings —
                confirm before sharing.
              </div>
            ) : null}
          </dl>
        ) : null}

        {copyHint ? (
          <p className="mt-3 text-[12px] text-emerald-800" role="status">
            {copyHint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
