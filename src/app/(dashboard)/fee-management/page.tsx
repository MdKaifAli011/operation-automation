"use client";

import { useMemo, useState } from "react";
import { INITIAL_LEADS } from "@/lib/mock-data";

const ROWS = [
  {
    id: "1",
    student: "Rahul Sharma",
    course: "NEET",
    total: 85000,
    discount: 10,
    final: 76500,
    paid: 40000,
    emi: 12,
    status: "Partial" as const,
  },
  {
    id: "2",
    student: "Sneha Patel",
    course: "JEE",
    total: 90000,
    discount: 5,
    final: 85500,
    paid: 85500,
    emi: 0,
    status: "Paid" as const,
  },
  {
    id: "3",
    student: "Aryan Mehta",
    course: "CUET",
    total: 70000,
    discount: 0,
    final: 70000,
    paid: 0,
    emi: 6,
    status: "Pending" as const,
  },
];

export default function FeeManagementPage() {
  const rows = ROWS;
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterCourse && r.course !== filterCourse) return false;
      return true;
    });
  }, [rows, filterStatus, filterCourse]);

  const totals = useMemo(() => {
    const totalRev = rows.reduce((s, r) => s + r.total, 0);
    const collected = rows.reduce((s, r) => s + r.paid, 0);
    const pending = rows.reduce((s, r) => s + (r.final - r.paid), 0);
    return {
      totalRev,
      collected,
      pending,
      month: 120000,
    };
  }, [rows]);

  const badge = (s: string) => {
    const map: Record<string, string> = {
      Paid: "bg-[#e8f5e9] text-[#2e7d32]",
      Partial: "bg-[#fffde7] text-[#f57f17]",
      Pending: "bg-[#e3f2fd] text-[#1565c0]",
      Overdue: "bg-[#ffebee] text-[#c62828]",
    };
    return map[s] ?? "bg-[#f5f5f5] text-[#757575]";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Fee Management</h1>
        <button
          type="button"
          className="rounded-[6px] bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
        >
          + Add Fee Structure
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Total Revenue", `₹${(totals.totalRev / 1000).toFixed(0)},000`, "text-[#1565c0]"],
          ["Collected", `₹${(totals.collected / 1000).toFixed(0)},000`, "text-[#2e7d32]"],
          ["Pending", `₹${(totals.pending / 1000).toFixed(0)},000`, "text-[#f57f17]"],
          ["This Month", `₹${(totals.month / 1000).toFixed(0)},000`, "text-[#212121]"],
        ].map(([label, val, c]) => (
          <div
            key={label}
            className="rounded-[12px] border border-[#e0e0e0] bg-white p-4"
          >
            <p className="text-xs text-[#757575]">{label}</p>
            <p className={`mt-1 text-lg font-bold ${c}`}>{val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Paid">Paid</option>
          <option value="Partial">Partial</option>
          <option value="Pending">Pending</option>
          <option value="Overdue">Overdue</option>
        </select>
        <select
          className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm"
          value={filterCourse}
          onChange={(e) => setFilterCourse(e.target.value)}
        >
          <option value="">All courses</option>
          <option value="NEET">NEET</option>
          <option value="JEE">JEE</option>
          <option value="CUET">CUET</option>
        </select>
        <input type="date" className="rounded-[6px] border border-[#e0e0e0] px-3 py-2 text-sm" />
      </div>

      <div className="overflow-auto rounded-[6px] border border-[#e0e0e0]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8f9fa] text-left text-xs uppercase text-[#757575]">
              <th className="border-b border-[#e0e0e0] px-2 py-2">#</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Student</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Course</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Total</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Discount</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Final</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Paid</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Balance</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">EMI</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Status</th>
              <th className="border-b border-[#e0e0e0] px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.id} className="min-h-[40px] hover:bg-[#f5f5f5]">
                <td className="border-b border-[#e0e0e0] px-2 py-2">{i + 1}</td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">{r.student}</td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">{r.course}</td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  ₹{r.total.toLocaleString("en-IN")}
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  <input
                    type="number"
                    className="w-14 rounded-[6px] border border-[#e0e0e0] px-1"
                    defaultValue={r.discount}
                  />
                  %
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  ₹{r.final.toLocaleString("en-IN")}
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  ₹{r.paid.toLocaleString("en-IN")}
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  ₹{(r.final - r.paid).toLocaleString("en-IN")}
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  {r.emi ? `${r.emi} mo` : "—"}
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2">
                  <span
                    className={`rounded-[4px] px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="border-b border-[#e0e0e0] px-2 py-2 text-[#1565c0]">
                  View · Edit · Reminder
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#757575]">
        Sample rows linked to lead data count: {INITIAL_LEADS.length} leads in system.
      </p>
    </div>
  );
}
