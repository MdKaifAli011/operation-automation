"use client";

import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BankAccountsSection } from "@/components/bank-details/BankAccountsSection";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  DEFAULT_INSTITUTE,
  normBankAccountId,
  type BankAccountRecord,
  type InstituteRecord,
} from "@/lib/instituteProfileTypes";

type Snapshot = {
  institute: InstituteRecord;
  bankAccounts: BankAccountRecord[];
  defaultFeeBankAccountId: string | null;
};

function formatSavedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

export default function BankDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [institute, setInstitute] = useState<InstituteRecord>(DEFAULT_INSTITUTE);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([]);
  const [defaultFeeBankAccountId, setDefaultFeeBankAccountId] = useState<
    string | null
  >(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [instituteUpdatedAt, setInstituteUpdatedAt] = useState<string | null>(
    null,
  );
  const [bankUpdatedAt, setBankUpdatedAt] = useState<string | null>(null);

  const applyInstitutePayload = useCallback(
    (data: Record<string, unknown>) => {
      const inst = data.institute;
      setInstitute(
        inst && typeof inst === "object" && !Array.isArray(inst)
          ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
          : DEFAULT_INSTITUTE,
      );
      const u = data.updatedAt;
      setInstituteUpdatedAt(typeof u === "string" ? u : null);
    },
    [],
  );

  const applyBankPayload = useCallback((data: Record<string, unknown>) => {
    const banks = data.bankAccounts;
    setBankAccounts(Array.isArray(banks) ? (banks as BankAccountRecord[]) : []);
    const def = normBankAccountId(data.defaultFeeBankAccountId);
    setDefaultFeeBankAccountId(def || null);
    const u = data.updatedAt;
    setBankUpdatedAt(typeof u === "string" ? u : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void Promise.all([
      fetch("/api/settings/institute-profile", { cache: "no-store" }).then(
        async (res) => {
          const data = (await res.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          if (!res.ok) {
            throw new Error(
              typeof data.error === "string"
                ? data.error
                : "Could not load institute details.",
            );
          }
          return data;
        },
      ),
      fetch("/api/settings/bank-profile", { cache: "no-store" }).then(
        async (res) => {
          const data = (await res.json().catch(() => ({}))) as Record<
            string,
            unknown
          >;
          if (!res.ok) {
            throw new Error(
              typeof data.error === "string"
                ? data.error
                : "Could not load bank accounts.",
            );
          }
          return data;
        },
      ),
    ])
      .then(([instData, bankData]) => {
        if (cancelled) return;
        applyInstitutePayload(instData);
        applyBankPayload(bankData);
        const inst = instData.institute;
        const banks = bankData.bankAccounts;
        const defId = bankData.defaultFeeBankAccountId;
        setSnapshot({
          institute:
            inst && typeof inst === "object" && !Array.isArray(inst)
              ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
              : { ...DEFAULT_INSTITUTE },
          bankAccounts: Array.isArray(banks)
            ? (banks as BankAccountRecord[]).map((a) => ({ ...a }))
            : [],
          defaultFeeBankAccountId: normBankAccountId(defId) || null,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Could not load.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyInstitutePayload, applyBankPayload]);

  const save = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const [resI, resB] = await Promise.all([
        fetch("/api/settings/institute-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institute }),
        }),
        fetch("/api/settings/bank-profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankAccounts,
            defaultFeeBankAccountId,
          }),
        }),
      ]);
      const dataI = (await resI.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const dataB = (await resB.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!resI.ok) {
        throw new Error(
          typeof dataI.error === "string"
            ? dataI.error
            : "Could not save institute details.",
        );
      }
      if (!resB.ok) {
        throw new Error(
          typeof dataB.error === "string"
            ? dataB.error
            : "Could not save bank accounts.",
        );
      }
      applyInstitutePayload(dataI);
      applyBankPayload(dataB);
      const inst = dataI.institute;
      const banks = dataB.bankAccounts;
      const defId = dataB.defaultFeeBankAccountId;
      setSnapshot({
        institute:
          inst && typeof inst === "object" && !Array.isArray(inst)
            ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
            : { ...DEFAULT_INSTITUTE },
        bankAccounts: Array.isArray(banks)
          ? (banks as BankAccountRecord[]).map((a) => ({ ...a }))
          : [],
        defaultFeeBankAccountId: normBankAccountId(defId) || null,
      });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [
    applyInstitutePayload,
    applyBankPayload,
    bankAccounts,
    defaultFeeBankAccountId,
    institute,
  ]);

  const resetToSnapshot = useCallback(() => {
    setSaveError(null);
    if (!snapshot) {
      setInstitute({ ...DEFAULT_INSTITUTE });
      setBankAccounts([]);
      setDefaultFeeBankAccountId(null);
      return;
    }
    setInstitute({ ...snapshot.institute });
    setBankAccounts(snapshot.bankAccounts.map((a) => ({ ...a })));
    setDefaultFeeBankAccountId(snapshot.defaultFeeBankAccountId);
  }, [snapshot]);

  const handleAccountsChange = useCallback(
    (next: BankAccountRecord[]) => {
      setBankAccounts(next);
      setDefaultFeeBankAccountId((prev) => {
        const p = normBankAccountId(prev);
        if (!p) return prev;
        const acc = next.find((a) => normBankAccountId(a.id) === p);
        if (!acc || !acc.isActive) return null;
        return p;
      });
    },
    [],
  );

  const formDisabled = loading || saving;

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Bank &amp; Account Details</h1>
            <p className={SX.toolbarMeta}>
              Institute profile and bank accounts are stored separately — default
              fee bank applies only to bank accounts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={formDisabled}
              onClick={resetToSnapshot}
            >
              Reset
            </button>
            <button
              type="submit"
              form="bank-details-form"
              className={SX.leadBtnGreen}
              disabled={formDisabled}
            >
              {saving ? "Saving…" : "Save Details"}
            </button>
          </div>
        </div>

        <div className={SX.leadStatBar}>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[#757575]">Last saved</span>
            <span className="font-medium tabular-nums text-[#212121]">
              {loading ? (
                "Loading…"
              ) : (
                <>
                  <span className="text-[#757575]">Institute</span>{" "}
                  {formatSavedAt(instituteUpdatedAt)}
                  <span className="mx-1.5 text-[#bdbdbd]" aria-hidden>
                    ·
                  </span>
                  <span className="text-[#757575]">Banks</span>{" "}
                  {formatSavedAt(bankUpdatedAt)}
                </>
              )}
            </span>
          </span>
          <span className="hidden sm:inline text-[#bdbdbd]" aria-hidden>
            |
          </span>
          <span className="rounded-none bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-900">
            Stored in database
          </span>
        </div>

        {loadError ? (
          <div
            className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[13px] text-rose-900"
            role="alert"
          >
            {loadError}
          </div>
        ) : null}
        {saveError ? (
          <div
            className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-[13px] text-rose-900"
            role="alert"
          >
            {saveError}
          </div>
        ) : null}

        <form
          id="bank-details-form"
          className="divide-y divide-[#d0d0d0] border-b border-[#d0d0d0] bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <section className="overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className={SX.sectionHead}>
              <h2 className={SX.sectionTitle}>Institute Details</h2>
              <span className={SX.leadSectionMeta}>Legal &amp; contact</span>
            </div>
            <div className={cn(SX.sectionBody, "overflow-x-auto")}>
              <table className={SX.kvTable}>
                <tbody>
                  <KvRow label="Institute Name">
                    <input
                      className={SX.input}
                      name="instituteName"
                      placeholder="Institute name"
                      value={institute.instituteName}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          instituteName: e.target.value,
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Registration Number">
                    <input
                      className={SX.input}
                      name="regNo"
                      value={institute.regNo}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, regNo: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="GST Number">
                    <input
                      className={SX.input}
                      name="gst"
                      value={institute.gst}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, gst: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Fee GST % (NRO / tax preview)">
                    <input
                      className={cn(SX.input, "max-w-[120px] tabular-nums")}
                      name="feeGstPercent"
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={institute.feeGstPercent}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          feeGstPercent: Math.min(
                            100,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                      disabled={formDisabled}
                    />
                    <span className="ml-2 text-[11px] text-slate-500">
                      Used on Step 3 fee preview (Option 3 — NRO).
                    </span>
                  </KvRow>
                  <KvRow label="INR per 1 USD (FX)">
                    <input
                      className={cn(SX.input, "max-w-[140px] tabular-nums")}
                      name="inrPerUsd"
                      type="number"
                      min={0.0001}
                      step={0.01}
                      value={institute.inrPerUsd}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          inrPerUsd: Math.max(
                            0.0001,
                            Number(e.target.value) || 0,
                          ),
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="INR per 1 AED (FX)">
                    <input
                      className={cn(SX.input, "max-w-[140px] tabular-nums")}
                      name="inrPerAed"
                      type="number"
                      min={0.0001}
                      step={0.01}
                      value={institute.inrPerAed}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          inrPerAed: Math.max(
                            0.0001,
                            Number(e.target.value) || 0,
                          ),
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Address">
                    <textarea
                      className={SX.textarea}
                      name="address"
                      rows={3}
                      placeholder="Registered address"
                      value={institute.address}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, address: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="City">
                    <input
                      className={SX.input}
                      name="city"
                      value={institute.city}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, city: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="State">
                    <input
                      className={SX.input}
                      name="state"
                      value={institute.state}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, state: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Country">
                    <input
                      className={SX.input}
                      name="country"
                      placeholder="Country"
                      value={institute.country}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          country: e.target.value,
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Pincode">
                    <input
                      className={SX.input}
                      name="pincode"
                      value={institute.pincode}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          pincode: e.target.value,
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Institute Phone">
                    <input
                      className={SX.input}
                      name="phone"
                      inputMode="tel"
                      value={institute.phone}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, phone: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Institute Email">
                    <input
                      className={SX.input}
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={institute.email}
                      onChange={(e) =>
                        setInstitute((s) => ({ ...s, email: e.target.value }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                  <KvRow label="Website">
                    <input
                      className={SX.input}
                      name="website"
                      type="url"
                      value={institute.website}
                      onChange={(e) =>
                        setInstitute((s) => ({
                          ...s,
                          website: e.target.value,
                        }))
                      }
                      disabled={formDisabled}
                    />
                  </KvRow>
                </tbody>
              </table>
            </div>
          </section>

          <BankAccountsSection
            accounts={bankAccounts}
            onAccountsChange={handleAccountsChange}
            defaultFeeBankAccountId={defaultFeeBankAccountId}
            onDefaultFeeBankAccountIdChange={setDefaultFeeBankAccountId}
            disabled={formDisabled}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d0d0d0] bg-[#fafafa] px-3 py-2.5">
            <p className="text-[12px] text-[#757575]">
              Bank accounts appear on each student&apos;s Fees step (Step 3) for
              ops and parent-facing copy.
            </p>
            <button
              type="submit"
              className={SX.leadBtnGreen}
              disabled={formDisabled}
            >
              {saving ? "Saving…" : "Save Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KvRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr>
      <th className={SX.kvTh}>{label}</th>
      <td className={SX.kvTd}>{children}</td>
    </tr>
  );
}
