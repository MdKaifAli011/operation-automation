"use client";

import { useState } from "react";

export default function BankDetailsPage() {
  const [showAcct, setShowAcct] = useState(false);
  const [bank, setBank] = useState("SBI");
  const [emiRzp, setEmiRzp] = useState(false);
  const [emiPayu, setEmiPayu] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#212121]">Bank &amp; Account Details</h1>
        <p className="mt-1 text-sm text-[#757575]">
          Used for fee receipts and student communication
        </p>
      </div>

      <form
        className="space-y-8 rounded-[12px] border border-[#e0e0e0] bg-white p-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <section>
          <h2 className="mb-4 border-b border-[#e0e0e0] pb-2 text-base font-semibold">
            Institute Details
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Institute Name" defaultValue="Testprepkart" />
            <Field label="Registration Number" />
            <Field label="GST Number" />
            <label className="md:col-span-2 block text-sm">
              <span className="text-[#757575]">Address</span>
              <textarea
                rows={3}
                className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2"
                defaultValue="123 Education Street"
              />
            </label>
            <Field label="City" />
            <Field label="State" />
            <Field label="Country" defaultValue="India" />
            <Field label="Pincode" />
            <Field label="Institute Phone" />
            <Field label="Institute Email" type="email" />
            <Field label="Website" />
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b border-[#e0e0e0] pb-2 text-base font-semibold">
            Bank Details
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#757575]">Bank Name</span>
              <select
                className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              >
                <option value="SBI">SBI</option>
                <option value="HDFC">HDFC</option>
                <option value="ICICI">ICICI</option>
                <option value="Axis">Axis</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <Field label="Account Holder Name" defaultValue="LMS Doors Academy" />
            <label className="block text-sm md:col-span-2">
              <span className="text-[#757575]">Account Number</span>
              <div className="mt-1 flex gap-2">
                <input
                  type={showAcct ? "text" : "password"}
                  className="flex-1 rounded-[6px] border border-[#e0e0e0] px-3 py-2"
                  defaultValue="****1234"
                  readOnly
                />
                <button
                  type="button"
                  className="rounded-[6px] border border-[#e0e0e0] px-3 text-sm"
                  onClick={() => setShowAcct((v) => !v)}
                >
                  {showAcct ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            <Field label="IFSC Code" />
            <Field label="Branch Name" />
            <label className="block text-sm">
              <span className="text-[#757575]">Account Type</span>
              <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                <option>Current</option>
                <option>Savings</option>
              </select>
            </label>
            <Field label="UPI ID" />
          </div>
        </section>

        <section>
          <h2 className="mb-4 border-b border-[#e0e0e0] pb-2 text-base font-semibold">
            Payment Options
          </h2>
          <div className="space-y-3 text-sm">
            <Toggle label="Bank Transfer" defaultOn />
            <Toggle label="UPI" defaultOn />
            <Toggle label="Cash" defaultOn />
            <Toggle label="Cheque" />
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emiRzp}
                  onChange={(e) => setEmiRzp(e.target.checked)}
                />
                EMI via Razorpay
              </label>
              {emiRzp && (
                <input
                  placeholder="API key"
                  className="rounded-[6px] border border-[#e0e0e0] px-2 py-1 text-xs"
                />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emiPayu}
                  onChange={(e) => setEmiPayu(e.target.checked)}
                />
                EMI via PayU
              </label>
              {emiPayu && (
                <input
                  placeholder="API key"
                  className="rounded-[6px] border border-[#e0e0e0] px-2 py-1 text-xs"
                />
              )}
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e0e0e0] pt-4">
          <p className="text-xs text-[#757575]">Last saved: 03 Apr 2026, 10:30 AM</p>
          <button
            type="submit"
            className="rounded-[6px] bg-[#2e7d32] px-6 py-2 font-medium text-white"
          >
            Save Details
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  defaultValue,
  type = "text",
}: {
  label: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[#757575]">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2"
      />
    </label>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" defaultChecked={defaultOn} />
      {label}
    </label>
  );
}
