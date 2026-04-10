"use client";

import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BankAccountsSection } from "@/components/bank-details/BankAccountsSection";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import {
  DEFAULT_INSTITUTE,
  type BankAccountRecord,
  type InstituteRecord,
} from "@/lib/instituteProfileTypes";

type Snapshot = {
  institute: InstituteRecord;
  bankAccounts: BankAccountRecord[];
};

export default function BankDetailsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [institute, setInstitute] = useState<InstituteRecord>(DEFAULT_INSTITUTE);
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(null);

  const applyPayload = useCallback((body: Record<string, unknown>) => {
    const inst = body.institute;
    setInstitute(
      inst && typeof inst === "object" && !Array.isArray(inst)
        ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
        : DEFAULT_INSTITUTE,
    );
    const banks = body.bankAccounts;
    setBankAccounts(Array.isArray(banks) ? (banks as BankAccountRecord[]) : []);
    const u = body.updatedAt;
    setServerUpdatedAt(typeof u === "string" ? u : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetch("/api/settings/institute-profile", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Could not load settings.",
          );
        }
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        applyPayload(data);
        const inst = data.institute;
        const banks = data.bankAccounts;
        setSnapshot({
          institute:
            inst && typeof inst === "object" && !Array.isArray(inst)
              ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
              : { ...DEFAULT_INSTITUTE },
          bankAccounts: Array.isArray(banks)
            ? (banks as BankAccountRecord[]).map((a) => ({ ...a }))
            : [],
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
  }, [applyPayload]);

  const save = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/institute-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institute, bankAccounts }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not save.",
        );
      }
      applyPayload(data);
      const inst = data.institute;
      const banks = data.bankAccounts;
      setSnapshot({
        institute:
          inst && typeof inst === "object" && !Array.isArray(inst)
            ? { ...DEFAULT_INSTITUTE, ...(inst as InstituteRecord) }
            : { ...DEFAULT_INSTITUTE },
        bankAccounts: Array.isArray(banks)
          ? (banks as BankAccountRecord[]).map((a) => ({ ...a }))
          : [],
      });
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }, [applyPayload, bankAccounts, institute]);

  const resetToSnapshot = useCallback(() => {
    setSaveError(null);
    if (!snapshot) {
      setInstitute({ ...DEFAULT_INSTITUTE });
      setBankAccounts([]);
      return;
    }
    setInstitute({ ...snapshot.institute });
    setBankAccounts(snapshot.bankAccounts.map((a) => ({ ...a })));
  }, [snapshot]);

  const lastSavedLabel =
    serverUpdatedAt &&
    (() => {
      try {
        return format(parseISO(serverUpdatedAt), "dd MMM yyyy, HH:mm");
      } catch {
        return serverUpdatedAt;
      }
    })();

  const formDisabled = loading || saving;

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Bank &amp; Account Details</h1>
            <p className={SX.toolbarMeta}>
              Institute profile · Shown on the student Fees step for bank transfer
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
          <span>
            <span className="text-[#757575]">Last saved</span>{" "}
            <span className="font-medium tabular-nums text-[#212121]">
              {loading
                ? "Loading…"
                : lastSavedLabel ?? "Not saved yet (nothing in database)"}
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
            onAccountsChange={setBankAccounts}
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
