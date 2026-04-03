"use client";

import { useState, type ReactNode } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

export default function BankDetailsPage() {
  const [showAcct, setShowAcct] = useState(false);
  const [bank, setBank] = useState("SBI");
  const [emiRzp, setEmiRzp] = useState(false);
  const [emiPayu, setEmiPayu] = useState(false);

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Bank &amp; Account Details</h1>
            <p className={SX.toolbarMeta}>
              Institute profile · Fee receipts &amp; student communication
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="reset"
              form="bank-details-form"
              className={SX.btnSecondary}
            >
              Reset
            </button>
            <button type="submit" form="bank-details-form" className={SX.leadBtnGreen}>
              Save Details
            </button>
          </div>
        </div>

        <div className={SX.leadStatBar}>
          <span>
            <span className="text-[#757575]">Last saved</span>{" "}
            <span className="font-medium tabular-nums text-[#212121]">
              03 Apr 2026, 10:30 AM
            </span>
          </span>
          <span className="hidden sm:inline text-[#bdbdbd]" aria-hidden>
            |
          </span>
          <span className="rounded-[2px] bg-[#e8f5e9] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#2e7d32]">
            Active profile
          </span>
        </div>

        <form
          id="bank-details-form"
          className="divide-y divide-[#d0d0d0] border-b border-[#d0d0d0] bg-white"
          onSubmit={(e) => e.preventDefault()}
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
                      defaultValue="Testprepkart"
                    />
                  </KvRow>
                  <KvRow label="Registration Number">
                    <input className={SX.input} name="regNo" />
                  </KvRow>
                  <KvRow label="GST Number">
                    <input className={SX.input} name="gst" />
                  </KvRow>
                  <KvRow label="Address">
                    <textarea
                      className={SX.textarea}
                      name="address"
                      rows={3}
                      defaultValue="123 Education Street"
                    />
                  </KvRow>
                  <KvRow label="City">
                    <input className={SX.input} name="city" />
                  </KvRow>
                  <KvRow label="State">
                    <input className={SX.input} name="state" />
                  </KvRow>
                  <KvRow label="Country">
                    <input
                      className={SX.input}
                      name="country"
                      defaultValue="India"
                    />
                  </KvRow>
                  <KvRow label="Pincode">
                    <input className={SX.input} name="pincode" />
                  </KvRow>
                  <KvRow label="Institute Phone">
                    <input className={SX.input} name="phone" inputMode="tel" />
                  </KvRow>
                  <KvRow label="Institute Email">
                    <input
                      className={SX.input}
                      name="email"
                      type="email"
                      autoComplete="email"
                    />
                  </KvRow>
                  <KvRow label="Website">
                    <input className={SX.input} name="website" type="url" />
                  </KvRow>
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className={SX.sectionHead}>
              <h2 className={SX.sectionTitle}>Bank Details</h2>
              <span className={SX.leadSectionMeta}>Settlement account</span>
            </div>
            <div className={cn(SX.sectionBody, "overflow-x-auto")}>
              <table className={SX.kvTable}>
                <tbody>
                  <KvRow label="Bank Name">
                    <select
                      className={cn(SX.select, "w-full max-w-md")}
                      name="bankName"
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                    >
                      <option value="SBI">SBI</option>
                      <option value="HDFC">HDFC</option>
                      <option value="ICICI">ICICI</option>
                      <option value="Axis">Axis</option>
                      <option value="Other">Other</option>
                    </select>
                  </KvRow>
                  <KvRow label="Account Holder Name">
                    <input
                      className={SX.input}
                      name="acctHolder"
                      defaultValue="LMS Doors Academy"
                    />
                  </KvRow>
                  <KvRow label="Account Number">
                    <div className="flex max-w-md flex-wrap items-stretch gap-2">
                      <input
                        type={showAcct ? "text" : "password"}
                        className={SX.input}
                        name="acctNo"
                        defaultValue="****1234"
                        readOnly
                        aria-label="Account number"
                      />
                      <button
                        type="button"
                        className={cn(SX.btnSecondary, "shrink-0 px-3")}
                        onClick={() => setShowAcct((v) => !v)}
                      >
                        {showAcct ? "Hide" : "Show"}
                      </button>
                    </div>
                  </KvRow>
                  <KvRow label="IFSC Code">
                    <input className={SX.input} name="ifsc" />
                  </KvRow>
                  <KvRow label="Branch Name">
                    <input className={SX.input} name="branch" />
                  </KvRow>
                  <KvRow label="Account Type">
                    <select className={cn(SX.select, "w-full max-w-md")} name="acctType">
                      <option>Current</option>
                      <option>Savings</option>
                    </select>
                  </KvRow>
                  <KvRow label="UPI ID">
                    <input className={SX.input} name="upi" />
                  </KvRow>
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <div className={SX.sectionHead}>
              <h2 className={SX.sectionTitle}>Payment Options</h2>
              <span className={SX.leadSectionMeta}>Channels offered to students</span>
            </div>
            <div className={cn(SX.sectionBody, "overflow-x-auto p-0")}>
              <table className={SX.dataTable}>
                <thead>
                  <tr>
                    <th className={SX.dataTh}>Method</th>
                    <th className={cn(SX.dataTh, "w-[100px] text-center")}>
                      Enabled
                    </th>
                    <th className={SX.dataTh}>Configuration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={SX.dataTd}>Bank transfer</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_bank"
                        defaultChecked
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTdMuted}>—</td>
                  </tr>
                  <tr className={SX.zebraRow}>
                    <td className={SX.dataTd}>UPI</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_upi"
                        defaultChecked
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTdMuted}>—</td>
                  </tr>
                  <tr>
                    <td className={SX.dataTd}>Cash</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_cash"
                        defaultChecked
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTdMuted}>—</td>
                  </tr>
                  <tr className={SX.zebraRow}>
                    <td className={SX.dataTd}>Cheque</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_cheque"
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTdMuted}>—</td>
                  </tr>
                  <tr>
                    <td className={SX.dataTd}>EMI · Razorpay</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_emi_rzp"
                        checked={emiRzp}
                        onChange={(e) => setEmiRzp(e.target.checked)}
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTd}>
                      {emiRzp ? (
                        <input
                          className={SX.input}
                          name="rzp_key"
                          placeholder="API key · live_…"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="text-[#9e9e9e]">—</span>
                      )}
                    </td>
                  </tr>
                  <tr className={SX.zebraRow}>
                    <td className={SX.dataTd}>EMI · PayU</td>
                    <td className={cn(SX.dataTd, "text-center")}>
                      <input
                        type="checkbox"
                        name="po_emi_payu"
                        checked={emiPayu}
                        onChange={(e) => setEmiPayu(e.target.checked)}
                        className="h-4 w-4 accent-[#1565c0]"
                      />
                    </td>
                    <td className={SX.dataTd}>
                      {emiPayu ? (
                        <input
                          className={SX.input}
                          name="payu_key"
                          placeholder="Merchant key"
                          autoComplete="off"
                        />
                      ) : (
                        <span className="text-[#9e9e9e]">—</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d0d0d0] bg-[#fafafa] px-3 py-2.5">
            <p className="text-[12px] text-[#757575]">
              Changes apply to new fee receipts and payment links.
            </p>
            <button type="submit" className={SX.leadBtnGreen}>
              Save Details
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
