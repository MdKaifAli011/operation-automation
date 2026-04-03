"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import type { Lead } from "@/lib/types";
import { COURSE_OPTIONS, FACULTY_SEED } from "@/lib/mock-data";
import { extrasForLead } from "@/lib/student-detail";
import { cn } from "@/lib/cn";

const STEPS = [
  { id: "step-1", n: 1, label: "Demo" },
  { id: "step-2", n: 2, label: "Brochure" },
  { id: "step-3", n: 3, label: "Fees" },
  { id: "step-4", n: 4, label: "Enrollment" },
  { id: "step-5", n: 5, label: "Schedule" },
] as const;

type Props = { lead: Lead };

export function StudentDetailPage({ lead }: Props) {
  const extras = useMemo(() => extrasForLead(lead), [lead]);
  const completed = lead.pipelineSteps;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [enrolledOk, setEnrolledOk] = useState(false);
  const [scheduleView, setScheduleView] = useState<"table" | "calendar">(
    "table",
  );

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlight(id);
    window.setTimeout(() => setHighlight(null), 1500);
  }, []);

  const badgeClass =
    lead.rowTone === "interested"
      ? "bg-[#e8f5e9] text-[#2e7d32]"
      : lead.rowTone === "not_interested"
        ? "bg-[#ffebee] text-[#c62828]"
        : lead.rowTone === "followup_later"
          ? "bg-[#fffde7] text-[#f57f17]"
          : "bg-[#e3f2fd] text-[#1565c0]";

  return (
    <div className="flex flex-col gap-6 pb-12">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[#1565c0] underline"
      >
        ← Back to Leads
      </Link>

      <header className="flex flex-col gap-3 border-b border-[#e0e0e0] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-[#212121]">{lead.studentName}</h1>
          <span
            className={cn(
              "rounded-[4px] px-3 py-1 text-xs font-medium",
              badgeClass,
            )}
          >
            {extras.statusLabel}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#757575]">
          <span>
            📞 {lead.phone}{" "}
            <button type="button" className="text-[#1565c0]" title="Edit">
              ✎
            </button>
          </span>
          <span className="rounded-[4px] bg-[#e3f2fd] px-2 py-0.5 text-xs font-medium text-[#1565c0]">
            📚 {lead.course}
          </span>
          <span>
            🌍 {extras.country}{" "}
            <button type="button" className="text-[#1565c0]" title="Edit">
              ✎
            </button>
          </span>
          <span>
            📅 {format(parseISO(lead.date), "dd-MMMM-yyyy")}{" "}
            <button type="button" className="text-[#1565c0]" title="Edit">
              ✎
            </button>
          </span>
        </div>
      </header>

      <Stepper
        completed={completed}
        onStepClick={scrollTo}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-[3] space-y-6">
          <DemoSection lead={lead} highlight={highlight} />
          <BrochureSection highlight={highlight} />
          <FeeSection lead={lead} highlight={highlight} />
          <EnrollmentSection
            lead={lead}
            highlight={highlight}
            enrolledOk={enrolledOk}
            onSubmit={() => setEnrolledOk(true)}
          />
          <ScheduleSection
            view={scheduleView}
            onViewChange={setScheduleView}
            highlight={highlight}
          />
        </div>

        <aside className="w-full shrink-0 space-y-6 lg:w-[25%] lg:min-w-[260px]">
          <div className="rounded-[12px] border border-[#e0e0e0] p-4">
            <label className="text-sm font-medium text-[#212121]">Notes</label>
            <textarea
              rows={8}
              className="mt-2 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
              placeholder="Add notes about this student..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                setNotesSaved(true);
                window.setTimeout(() => setNotesSaved(false), 2000);
              }}
            />
            {notesSaved && (
              <p className="mt-1 text-xs text-[#2e7d32]">Saved ✓</p>
            )}
          </div>

          <div className="rounded-[12px] border border-[#e0e0e0] p-4">
            <h3 className="text-sm font-medium text-[#212121]">Call History</h3>
            <ul className="mt-3 space-y-3 border-t border-[#e0e0e0] pt-3 text-sm">
              <li className="border-b border-[#f0f0f0] pb-2">
                <div className="text-[#757575]">02 Apr 2026</div>
                <span className="mt-1 inline-block rounded-[4px] bg-[#e8f5e9] px-2 py-0.5 text-xs text-[#2e7d32]">
                  Interested
                </span>
                <p className="mt-1 italic text-[#757575]">Discussed fee plan.</p>
              </li>
              <li>
                <div className="text-[#757575]">28 Mar 2026</div>
                <span className="mt-1 inline-block rounded-[4px] bg-[#f5f5f5] px-2 py-0.5 text-xs text-[#757575]">
                  No Answer
                </span>
              </li>
            </ul>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[#1565c0] underline"
              onClick={() => setCallOpen((v) => !v)}
            >
              + Log Call
            </button>
            {callOpen && (
              <form
                className="mt-3 space-y-2 rounded-[6px] border border-[#e0e0e0] p-3 text-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  setCallOpen(false);
                }}
              >
                <input type="date" className="w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1" />
                <input placeholder="Duration" className="w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1" />
                <select className="w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1">
                  <option>Interested</option>
                  <option>No Answer</option>
                  <option>Callback</option>
                  <option>Not Interested</option>
                </select>
                <input placeholder="Notes" className="w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1" />
                <button
                  type="submit"
                  className="w-full rounded-[6px] bg-[#1565c0] py-2 text-white"
                >
                  Save Call
                </button>
              </form>
            )}
          </div>

          <div className="rounded-[12px] border border-[#e0e0e0] p-4">
            <h3 className="text-sm font-medium text-[#212121]">Activity</h3>
            <ul className="relative mt-4 space-y-4 border-l border-[#e0e0e0] pl-4 text-sm">
              {[
                ["✉", "Brochure sent via WhatsApp", "2 hours ago"],
                ["📞", "Call logged — Interested", "1 day ago"],
                ["📅", "Demo scheduled for Biology", "2 days ago"],
                ["➕", "Lead created", "3 days ago"],
              ].map(([icon, text, time], i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-0 flex h-3 w-3 items-center justify-center rounded-full bg-[#1565c0] text-[10px] text-white">
                    ·
                  </span>
                  <span className="text-[#212121]">
                    {icon} {text}
                  </span>
                  <div className="text-xs text-[#757575]">{time}</div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({
  completed,
  onStepClick,
}: {
  completed: number;
  onStepClick: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {STEPS.map((s, i) => {
          const done = completed >= s.n;
          const current = completed === s.n - 1;
          return (
            <div key={s.id} className="flex min-w-[120px] flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => onStepClick(s.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  done
                    ? "border-[#2e7d32] bg-[#2e7d32] text-white"
                    : current
                      ? "border-[#1565c0] bg-[#1565c0] text-white"
                      : "border-[#e0e0e0] bg-white text-[#757575]",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[10px]">
                  {done ? "✓" : s.n}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className="hidden h-px flex-1 bg-[#e0e0e0] md:block" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-sm text-[#757575]">
        {Math.min(Math.max(completed, 0), 5)} of 5 steps completed
      </p>
    </div>
  );
}

function DemoSection({ lead, highlight }: { lead: Lead; highlight: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<
    { subject: string; teacher: string; date: string; time: string; status: string }[]
  >([]);
  const id = "step-1";

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-[#e0e0e0] p-6 transition-shadow duration-150",
        highlight === id && "ring-2 ring-[#1565c0]",
      )}
    >
      <h2 className="border-l-4 border-[#1565c0] pl-3 text-base font-bold text-[#212121]">
        Step 1: Demo Classes
      </h2>
      {rows.length === 0 && !expanded ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-3 py-8 text-[#757575]">
          <span className="text-4xl">📅</span>
          <p>No demo scheduled yet</p>
          <button
            type="button"
            className="rounded-[6px] border border-[#1565c0] px-4 py-2 text-sm font-medium text-[#1565c0]"
            onClick={() => setExpanded(true)}
          >
            + Create Demo
          </button>
        </div>
      ) : rows.length === 0 && expanded ? (
        <DemoForm
          lead={lead}
          onCancel={() => setExpanded(false)}
          onSchedule={(r) => {
            setRows([r]);
            setExpanded(false);
          }}
        />
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fa] text-left text-xs uppercase">
                <th className="border border-[#e0e0e0] px-2 py-2">#</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Subject</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Teacher</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Date</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Time (IST)</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Local</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Status</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="min-h-[40px]">
                  <td className="border border-[#e0e0e0] px-2 py-2">{i + 1}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.subject}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.teacher}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.date}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{r.time}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2 text-[#757575]">
                    12:30 PM SGT
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    <select className="rounded-[6px] border border-[#e0e0e0] px-1 py-0.5 text-xs">
                      <option>Scheduled</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2 text-[#1565c0]">
                    Edit · Delete ·{" "}
                    <button type="button" className="rounded-full bg-[#e3f2fd] px-2 py-0.5 text-xs">
                      Send Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-[#1565c0] underline"
            onClick={() => setExpanded(true)}
          >
            + Add Another Demo
          </button>
          <p className="mt-2 text-xs text-[#757575]">
            Students can schedule multiple demos across different subjects.
          </p>
          {expanded && (
            <DemoForm
              lead={lead}
              onCancel={() => setExpanded(false)}
              onSchedule={(r) => {
                setRows((prev) => [...prev, r]);
                setExpanded(false);
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

function DemoForm({
  lead,
  onCancel,
  onSchedule,
}: {
  lead: Lead;
  onCancel: () => void;
  onSchedule: (r: {
    subject: string;
    teacher: string;
    date: string;
    time: string;
    status: string;
  }) => void;
}) {
  const [course, setCourse] = useState(lead.course);
  const subs =
    course === "NEET"
      ? ["Biology", "Physics", "Chemistry"]
      : course === "JEE"
        ? ["Physics", "Chemistry", "Mathematics"]
        : ["English", "GK", "Reasoning"];
  const [subj, setSubj] = useState(subs[0]);
  const teacher =
    subj === "Biology"
      ? "Dr. Meena Singh"
      : subj === "Physics"
        ? "Mr. Ravi Kumar"
        : FACULTY_SEED[0].name;

  return (
    <div className="mt-4 space-y-3 rounded-[6px] border border-[#e0e0e0] p-4">
      <label className="block text-sm">
        <span className="text-[#757575]">Course Name</span>
        <select
          className="mt-1 w-full max-w-md rounded-[6px] border border-[#e0e0e0] px-2 py-2"
          value={course}
          onChange={(e) => setCourse(e.target.value)}
        >
          {COURSE_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="text-sm text-[#757575]">Subject</span>
        <div className="mt-1 flex flex-wrap gap-3">
          {subs.map((s) => (
            <label key={s} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                defaultChecked
                onChange={() => setSubj(s)}
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className="text-[#757575]">Teacher</span>
        <select className="mt-1 w-full max-w-md rounded-[6px] border border-[#e0e0e0] px-2 py-2">
          <option>{teacher}</option>
          {FACULTY_SEED.map((f) => (
            <option key={f.id}>{f.name}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-[#757575]">Demo Date</span>
          <input type="date" className="mt-1 block rounded-[6px] border border-[#e0e0e0] px-2 py-2" />
        </label>
        <label className="text-sm">
          <span className="text-[#757575]">Demo Time (IST)</span>
          <input type="time" defaultValue="10:00" className="mt-1 block rounded-[6px] border border-[#e0e0e0] px-2 py-2" />
        </label>
      </div>
      <p className="text-xs text-[#757575]">
        10:00 AM IST = 12:30 PM SGT (Asia/Singapore) — based on student country.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          className="rounded-[6px] bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
          onClick={() =>
            onSchedule({
              subject: subj,
              teacher,
              date: format(new Date(), "dd/MM/yyyy"),
              time: "10:00 AM",
              status: "Scheduled",
            })
          }
        >
          Schedule Demo
        </button>
        <button
          type="button"
          className="text-sm text-[#757575] underline"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BrochureSection({ highlight }: { highlight: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [genPreview, setGenPreview] = useState(false);
  const id = "step-2";

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-[#e0e0e0] p-6 transition-shadow duration-150",
        highlight === id && "ring-2 ring-[#1565c0]",
      )}
    >
      <h2 className="border-l-4 border-[#1565c0] pl-3 text-base font-bold">
        Step 2: Course Brochure
      </h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <label className="flex h-[180px] cursor-pointer flex-col items-center justify-center rounded-[6px] border border-dashed border-[#e0e0e0] bg-[#fafafa] px-4 text-center text-sm text-[#757575]">
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            ☁ Click to upload or drag PDF/image here
          </label>
          {file && (
            <p className="mt-2 text-sm">
              {file.name} ({Math.round(file.size / 1024)} KB) ·{" "}
              <button type="button" className="text-[#1565c0] underline">
                Preview
              </button>{" "}
              ·{" "}
              <button type="button" className="text-[#c62828] underline" onClick={() => setFile(null)}>
                Remove
              </button>
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">Generate from performance notes</label>
          <textarea
            rows={4}
            className="mt-2 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm"
            placeholder="Enter demo performance notes, strengths, areas to improve..."
          />
          <button
            type="button"
            className="mt-2 rounded-[6px] bg-[#1565c0] px-4 py-2 text-sm font-medium text-white"
            onClick={() => {
              window.setTimeout(() => setGenPreview(true), 400);
            }}
          >
            ✨ Generate Brochure
          </button>
          {genPreview && (
            <p className="mt-2 text-sm text-[#2e7d32]">Preview ready · Preview</p>
          )}
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="rounded-[6px] bg-[#25d366] px-4 py-2 text-sm font-medium text-white">
          Send via WhatsApp
        </button>
        <button type="button" className="rounded-[6px] bg-[#1565c0] px-4 py-2 text-sm font-medium text-white">
          Send via Email
        </button>
      </div>
    </section>
  );
}

function FeeSection({ lead, highlight }: { lead: Lead; highlight: string | null }) {
  const [discount, setDiscount] = useState(10);
  const [emi, setEmi] = useState(12);
  const total = 85000;
  const finalFee = Math.round(total * (1 - discount / 100));
  const monthly = Math.round(finalFee / emi);
  const [currency, setCurrency] = useState("INR");
  const rates: Record<string, number> = {
    INR: 1,
    USD: 0.012,
    AED: 0.044,
    GBP: 0.0095,
    EUR: 0.011,
    SGD: 0.016,
  };
  const converted = finalFee * (rates[currency] ?? 1);
  const id = "step-3";

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-[#e0e0e0] p-6 transition-shadow duration-150",
        highlight === id && "ring-2 ring-[#1565c0]",
      )}
    >
      <h2 className="border-l-4 border-[#1565c0] pl-3 text-base font-bold">
        Step 3: Fee Structure
      </h2>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8f9fa] text-left">
              <th className="border border-[#e0e0e0] px-2 py-2">Course</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Total Fee</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Discount (%)</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Final Fee</th>
              <th className="border border-[#e0e0e0] px-2 py-2">EMI Options</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-[#e0e0e0] px-2 py-2">{lead.course}</td>
              <td className="border border-[#e0e0e0] px-2 py-2">₹85,000</td>
              <td className="border border-[#e0e0e0] px-2 py-2">
                <input
                  type="number"
                  className="w-16 rounded-[6px] border border-[#e0e0e0] px-1"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </td>
              <td className="border border-[#e0e0e0] px-2 py-2 font-semibold">
                ₹{finalFee.toLocaleString("en-IN")}
              </td>
              <td className="border border-[#e0e0e0] px-2 py-2">
                <select
                  className="rounded-[6px] border border-[#e0e0e0] px-1 py-0.5"
                  value={emi}
                  onChange={(e) => setEmi(Number(e.target.value))}
                >
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm">
        Monthly EMI: ₹{monthly.toLocaleString("en-IN")} × {emi} months = ₹
        {finalFee.toLocaleString("en-IN")}
      </p>
      <div className="mt-4 rounded-[6px] border border-[#e0e0e0] p-4">
        <label className="text-sm font-medium">Convert to student&apos;s currency</label>
        <select
          className="mt-2 rounded-[6px] border border-[#e0e0e0] px-2 py-2"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          {["INR", "USD", "AED", "GBP", "EUR", "SGD"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p className="mt-2 font-bold">
          ₹{finalFee.toLocaleString("en-IN")} ≈{" "}
          {currency === "INR"
            ? `₹${finalFee.toLocaleString("en-IN")}`
            : `${converted.toFixed(2)} ${currency}`}
        </p>
        <p className="text-xs text-[#757575]">Exchange rate is approximate</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-sm font-medium">Send Fee Structure</span>
        <button type="button" className="rounded-[6px] bg-[#25d366] px-3 py-1.5 text-sm text-white">
          WhatsApp
        </button>
        <button type="button" className="rounded-[6px] bg-[#1565c0] px-3 py-1.5 text-sm text-white">
          Email
        </button>
      </div>
    </section>
  );
}

function EnrollmentSection({
  lead,
  highlight,
  enrolledOk,
  onSubmit,
}: {
  lead: Lead;
  highlight: string | null;
  enrolledOk: boolean;
  onSubmit: () => void;
}) {
  const id = "step-4";

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-[#e0e0e0] p-6 transition-shadow duration-150",
        highlight === id && "ring-2 ring-[#1565c0]",
      )}
    >
      <h2 className="border-l-4 border-[#1565c0] pl-3 text-base font-bold">
        Step 4: Enrollment Form
      </h2>
      {enrolledOk && (
        <div className="mt-3 rounded-[6px] bg-[#e8f5e9] px-4 py-3 text-sm text-[#2e7d32]">
          ✓ Enrollment Form Submitted Successfully
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Student Full Name" defaultValue={lead.studentName} />
        <Field label="Parent/Guardian Name" defaultValue={lead.parentName} />
        <Field label="Date of Birth" type="date" />
        <label className="text-sm">
          <span className="text-[#757575]">Gender</span>
          <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-2">
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
        </label>
        <Field label="Course" defaultValue={lead.course} />
        <Field label="Phone Number" defaultValue={lead.phone} />
        <Field label="WhatsApp Number" />
        <Field label="Email Address" />
        <label className="md:col-span-2 text-sm">
          <span className="text-[#757575]">Address</span>
          <textarea rows={3} className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-2" />
        </label>
        <Field label="City" />
        <Field label="State" />
        <Field label="Country" defaultValue="India" />
        <Field label="Emergency Contact Name" />
        <Field label="Emergency Number" />
        <Field label="Previous School / College" />
        <label className="text-sm">
          <span className="text-[#757575]">Board</span>
          <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-2">
            <option>CBSE</option>
            <option>ICSE</option>
            <option>State Board</option>
            <option>International</option>
          </select>
        </label>
        <Field label="Digital signature (type full name)" />
        <Field label="Date" type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} />
      </div>
      <button
        type="button"
        className="mt-6 w-full rounded-[6px] bg-[#2e7d32] py-3 text-sm font-medium text-white"
        onClick={onSubmit}
      >
        Submit Enrollment Form
      </button>
    </section>
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
    <label className="text-sm">
      <span className="text-[#757575]">{label}</span>
      <input
        type={type}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-2"
      />
    </label>
  );
}

function ScheduleSection({
  view,
  onViewChange,
  highlight,
}: {
  view: "table" | "calendar";
  onViewChange: (v: "table" | "calendar") => void;
  highlight: string | null;
}) {
  const id = "step-5";
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-24 rounded-[12px] border border-[#e0e0e0] p-6 transition-shadow duration-150",
        highlight === id && "ring-2 ring-[#1565c0]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="border-l-4 border-[#1565c0] pl-3 text-base font-bold">
          Step 5: Class Schedule
        </h2>
        <div className="flex rounded-[6px] border border-[#e0e0e0] p-0.5 text-sm">
          <button
            type="button"
            className={cn(
              "rounded-[4px] px-3 py-1",
              view === "table" ? "bg-[#1565c0] text-white" : "text-[#757575]",
            )}
            onClick={() => onViewChange("table")}
          >
            Table View
          </button>
          <button
            type="button"
            className={cn(
              "rounded-[4px] px-3 py-1",
              view === "calendar" ? "bg-[#1565c0] text-white" : "text-[#757575]",
            )}
            onClick={() => onViewChange("calendar")}
          >
            Calendar View
          </button>
        </div>
      </div>
      {view === "table" ? (
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fa] text-left text-xs uppercase">
                <th className="border border-[#e0e0e0] px-2 py-2">Day</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Subject</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Time (IST)</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Local</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Teacher</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Duration</th>
                <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-[#e0e0e0] px-2 py-2">Monday</td>
                <td className="border border-[#e0e0e0] px-2 py-2">Biology</td>
                <td className="border border-[#e0e0e0] px-2 py-2">9:00 AM</td>
                <td className="border border-[#e0e0e0] px-2 py-2">11:30 AM SGT</td>
                <td className="border border-[#e0e0e0] px-2 py-2">Dr. Meena Singh</td>
                <td className="border border-[#e0e0e0] px-2 py-2">90 min</td>
                <td className="border border-[#e0e0e0] px-2 py-2 text-[#1565c0]">Edit / Delete</td>
              </tr>
            </tbody>
          </table>
          <button type="button" className="mt-3 text-sm text-[#1565c0] underline">
            + Add Class
          </button>
        </div>
      ) : (
        <div className="mt-4 overflow-auto">
          <div className="mb-2 flex justify-between text-sm">
            <button type="button" className="text-[#1565c0]">
              ← Prev week
            </button>
            <span className="font-medium">Week of Apr 2026</span>
            <button type="button" className="text-[#1565c0]">
              Next week →
            </button>
          </div>
          <div className="grid min-w-[800px] grid-cols-[80px_repeat(7,1fr)] gap-px bg-[#e0e0e0] text-xs">
            <div className="bg-[#f8f9fa] p-1" />
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
              <div
                key={d}
                className={cn(
                  "bg-[#f8f9fa] p-2 text-center font-medium",
                  i === 0 && "bg-[#e3f2fd]",
                )}
              >
                {d}
              </div>
            ))}
            {hours.map((h) => (
              <Fragment key={h}>
                <div className="bg-white p-1 text-[#757575]">
                  {h > 12 ? `${h - 12} PM` : `${h} AM`}
                </div>
                {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                  <div
                    key={`${h}-${c}`}
                    className={cn(
                      "min-h-[28px] bg-white p-0.5",
                      c === 0 && "bg-[#f5fbff]",
                    )}
                  >
                    {h === 9 && c === 0 && (
                      <div
                        className="rounded bg-[#2e7d32] px-1 py-0.5 text-[10px] text-white"
                        title="Biology · Dr. Meena · 90 min"
                      >
                        Biology
                      </div>
                    )}
                  </div>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-sm font-medium">Send Schedule to Student</span>
        <button type="button" className="rounded-[6px] bg-[#25d366] px-3 py-1.5 text-sm text-white">
          via WhatsApp
        </button>
        <button type="button" className="rounded-[6px] bg-[#1565c0] px-3 py-1.5 text-sm text-white">
          via Email
        </button>
      </div>
    </section>
  );
}
