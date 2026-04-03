"use client";

import { format } from "date-fns";
import { useState } from "react";

const ENROLLED = [
  {
    id: "Testprepkart-2026-0341",
    name: "Rahul Sharma",
    course: "NEET",
    batch: "2026-27",
    date: "03/04/2026",
    fee: "Paid",
  },
];

export default function EnrollStudentPage() {
  const [done, setDone] = useState(false);
  const [sameWa, setSameWa] = useState(false);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Student Enrollment</h1>
        <button type="button" className="rounded-[6px] border border-[#e0e0e0] px-4 py-2 text-sm">
          View All Enrolled
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Total Enrolled", "340"],
          ["This Month", "28"],
          ["NEET", "180"],
          ["JEE", "120"],
          ["CUET", "40"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="rounded-[12px] border border-[#e0e0e0] bg-[#f8f9fa] p-4 text-center"
          >
            <p className="text-xs text-[#757575]">{k}</p>
            <p className="text-xl font-bold text-[#1565c0]">{v}</p>
          </div>
        ))}
      </div>

      {done && (
        <div className="rounded-[6px] border border-[#c8e6c9] bg-[#e8f5e9] px-4 py-3 text-sm text-[#2e7d32]">
          ✓ Student Enrolled Successfully · Enrollment ID:{" "}
          <strong>Testprepkart-2026-0341</strong>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rounded-[6px] bg-white px-3 py-1 text-[#1565c0]">
              Download Admission Form
            </button>
            <button type="button" className="rounded-[6px] bg-[#25d366] px-3 py-1 text-white">
              Send via WhatsApp
            </button>
            <button type="button" className="rounded-[6px] bg-[#1565c0] px-3 py-1 text-white">
              Send via Email
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[12px] border border-[#e0e0e0] bg-white p-6">
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
          }}
        >
          <Section title="Personal Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Student Full Name" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date of Birth" type="date" />
                <Field label="Age" placeholder="Auto" />
              </div>
              <label className="text-sm">
                <span className="text-[#757575]">Gender</span>
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
              <Field label="Nationality" defaultValue="Indian" />
              <label className="text-sm">
                <span className="text-[#757575]">Category</span>
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>General</option>
                  <option>OBC</option>
                  <option>SC</option>
                  <option>ST</option>
                </select>
              </label>
              <label className="block text-sm md:col-span-2">
                Photo
                <input type="file" accept="image/*" className="mt-1" />
              </label>
            </div>
          </Section>

          <Section title="Contact Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Mobile Number" />
              <div>
                <Field label="WhatsApp Number" disabled={sameWa} />
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sameWa}
                    onChange={(e) => setSameWa(e.target.checked)}
                  />
                  Same as mobile
                </label>
              </div>
              <Field label="Email" type="email" />
              <label className="md:col-span-2 block text-sm">
                Full Address
                <textarea rows={2} className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2" />
              </label>
              <Field label="City" />
              <Field label="State" />
              <Field label="Pincode" />
              <Field label="Country" defaultValue="India" />
            </div>
          </Section>

          <Section title="Course Details">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="text-[#757575]">Select Course</span>
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>NEET</option>
                  <option>JEE</option>
                  <option>CUET</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-[#757575]">Select Batch</span>
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>2026-27</option>
                  <option>2027-28</option>
                </select>
              </label>
              <div className="md:col-span-2">
                <span className="text-sm text-[#757575]">Stream / Subjects</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Biology", "Physics", "Chemistry"].map((s) => (
                    <label key={s} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" defaultChecked /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <label className="text-sm">
                Mode of Study
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>Online</option>
                  <option>Offline</option>
                  <option>Hybrid</option>
                </select>
              </label>
              <Field label="Starting Date" type="date" />
            </div>
          </Section>

          <Section title="Guardian Details">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Parent/Guardian Name" />
              <label className="text-sm">
                Relationship
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Guardian</option>
                </select>
              </label>
              <Field label="Parent Phone" />
              <Field label="Parent Email" type="email" />
              <Field label="Parent Occupation" />
            </div>
          </Section>

          <Section title="Previous Education">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="School/College Name" />
              <label className="text-sm">
                Board
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>CBSE</option>
                  <option>ICSE</option>
                  <option>State</option>
                  <option>International</option>
                </select>
              </label>
              <Field label="Class/Grade Completed" />
              <Field label="Percentage/Grade" />
            </div>
          </Section>

          <Section title="Fee Details (from Fee Structure)">
            <div className="grid gap-4 md:grid-cols-2 rounded-[6px] bg-[#f8f9fa] p-4">
              <p className="text-sm">
                <span className="text-[#757575]">Course Fee</span>{" "}
                <span className="font-semibold">₹85,000</span>
              </p>
              <p className="text-sm">
                <span className="text-[#757575]">Discount</span>{" "}
                <span className="font-semibold">10%</span>
              </p>
              <p className="text-sm">
                <span className="text-[#757575]">Final Fee</span>{" "}
                <span className="font-semibold">₹76,500</span>
              </p>
              <label className="text-sm">
                Payment Mode
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] bg-white px-3 py-2">
                  <option>Bank Transfer</option>
                  <option>UPI</option>
                  <option>Cash</option>
                  <option>Cheque</option>
                </select>
              </label>
              <label className="text-sm">
                EMI Plan (months)
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] bg-white px-3 py-2">
                  <option value="">None</option>
                  <option>3</option>
                  <option>6</option>
                  <option>12</option>
                </select>
              </label>
              <Field label="First Installment Date" type="date" />
            </div>
          </Section>

          <Section title="Documents Upload">
            <div className="grid gap-3 md:grid-cols-2">
              {["Aadhaar Card", "10th Marksheet", "11th Marksheet", "Passport Photo"].map(
                (d) => (
                  <label key={d} className="block text-sm">
                    {d}
                    <input type="file" className="mt-1 w-full text-xs" />
                  </label>
                ),
              )}
            </div>
          </Section>

          <Section title="Signature">
            <Field label="Digital signature (type full name)" />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" required />I confirm all details are correct
            </label>
            <Field
              label="Date"
              type="date"
              defaultValue={format(new Date(), "yyyy-MM-dd")}
            />
          </Section>

          <div className="flex flex-wrap justify-end gap-3 border-t border-[#e0e0e0] pt-6">
            <button
              type="button"
              className="rounded-[6px] border border-[#e0e0e0] px-6 py-3 text-sm font-medium"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              className="rounded-[6px] bg-[#2e7d32] px-8 py-3 text-sm font-medium text-white"
            >
              Enroll Student
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Enrolled Students</h2>
        <div className="overflow-auto rounded-[6px] border border-[#e0e0e0]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fa] text-left text-xs uppercase">
                <th className="border border-[#e0e0e0] px-2 py-2">#</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Enrollment ID</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Student</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Course</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Batch</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Date</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Fee</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ENROLLED.map((r, i) => (
                <tr key={r.id}>
                  <td className="border border-[#e0e0e0] px-2 py-2">{i + 1}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.id}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.name}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.course}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.batch}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.date}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.fee}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2 text-[#1565c0]">
                    View / Edit
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-4 border-l-4 border-[#1565c0] pl-3 text-base font-semibold">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({
  label,
  type = "text",
  defaultValue,
  placeholder,
  disabled,
}: {
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[#757575]">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2 disabled:bg-[#f5f5f5]"
      />
    </label>
  );
}
