"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import type { FeeRecord } from "@/lib/types";

type FeeRow = {
  id: string;
  student: string;
  course: string;
  total: number;
  discount: number;
  final: number;
  paid: number;
  emi: number;
  status: FeeRecord["status"];
};

type ExamFeeRow = {
  exam: string;
  baseFee: number;
  notes: string;
  updatedAt?: string | null;
};

export default function FeeManagementPage() {
  const {
    activeValues: targetCourseOptions,
    labelFor: targetCourseLabel,
    loading: targetExamsLoading,
  } = useTargetExamOptions();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCourse, setFilterCourse] = useState("");

  const [examRows, setExamRows] = useState<ExamFeeRow[]>([]);
  const [examLoading, setExamLoading] = useState(true);
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examSavedAt, setExamSavedAt] = useState<string | null>(null);

  const loadExamStructures = useCallback(async () => {
    setExamLoading(true);
    setExamError(null);
    try {
      const res = await fetch("/api/exam-fee-structures", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load exam fee defaults.");
      const data = (await res.json()) as ExamFeeRow[];
      if (Array.isArray(data)) {
        setExamRows(
          data.map((d) => ({
            exam: typeof d.exam === "string" ? d.exam : "",
            baseFee:
              typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
                ? d.baseFee
                : 0,
            notes: typeof d.notes === "string" ? d.notes : "",
            updatedAt: d.updatedAt ?? null,
          })),
        );
      }
    } catch (e) {
      setExamError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setExamLoading(false);
    }
  }, []);

  const saveExamStructures = useCallback(async () => {
    setExamSaving(true);
    setExamError(null);
    setExamSavedAt(null);
    try {
      const res = await fetch("/api/exam-fee-structures", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: examRows.map((r) => ({
            exam: r.exam,
            baseFee: r.baseFee,
            notes: r.notes,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed.");
      const data = (await res.json()) as ExamFeeRow[];
      if (Array.isArray(data)) {
        setExamRows(
          data.map((d) => ({
            exam: typeof d.exam === "string" ? d.exam : "",
            baseFee:
              typeof d.baseFee === "number" && Number.isFinite(d.baseFee)
                ? d.baseFee
                : 0,
            notes: typeof d.notes === "string" ? d.notes : "",
            updatedAt: d.updatedAt ?? null,
          })),
        );
      }
      setExamSavedAt(new Date().toISOString());
    } catch (e) {
      setExamError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setExamSaving(false);
    }
  }, [examRows]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feesRes, leadsRes] = await Promise.all([
        fetch("/api/fees", { cache: "no-store" }),
        fetch("/api/leads", { cache: "no-store" }),
      ]);
      if (!feesRes.ok) throw new Error("fees");
      const fees = (await feesRes.json()) as FeeRecord[];
      setRows(
        fees.map((f) => ({
          id: f.id,
          student: f.studentName,
          course: f.course,
          total: f.total,
          discount: f.discount,
          final: f.final,
          paid: f.paid,
          emi: f.emi,
          status: f.status,
        })),
      );
      if (leadsRes.ok) {
        const leads = (await leadsRes.json()) as unknown[];
        setLeadCount(leads.length);
      }
    } catch {
      setError("Could not load fee data. Check MongoDB and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadExamStructures();
  }, [loadExamStructures]);

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
      month: collected,
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

  const updateExamBaseFee = (exam: string, baseFee: number) => {
    setExamRows((prev) =>
      prev.map((r) => (r.exam === exam ? { ...r, baseFee } : r)),
    );
  };

  const updateExamNotes = (exam: string, notes: string) => {
    setExamRows((prev) =>
      prev.map((r) => (r.exam === exam ? { ...r, notes } : r)),
    );
  };

  return (
    <div className="space-y-8">
      <section
        id="exam-fee-defaults"
        className="space-y-4 rounded-none border border-[#e0e0e0] bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#212121]">
              Default fees by target exam
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-[#757575]">
              Set the base fee (INR) for each target exam from your Exams &amp;
              subjects settings. On a lead, when that exam is selected and the fee
              step has no base amount yet, this value auto-fills on the student
              workspace.
            </p>
          </div>
          <button
            type="button"
            className="rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={examSaving || examLoading || targetExamsLoading}
            onClick={() => void saveExamStructures()}
          >
            {examSaving ? "Saving…" : "Save exam defaults"}
          </button>
        </div>
        {examError && (
          <p className="text-sm text-rose-700" role="alert">
            {examError}
          </p>
        )}
        {examSavedAt && (
          <p className="text-xs text-[#2e7d32]">
            Saved exam defaults ({new Date(examSavedAt).toLocaleString()}).
          </p>
        )}
        {examLoading || targetExamsLoading ? (
          <p className="text-sm text-[#757575]">Loading exam defaults…</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#f8f9fa] text-left text-xs uppercase text-[#757575]">
                  <th className="border border-[#e0e0e0] px-2 py-2">Exam</th>
                  <th className="border border-[#e0e0e0] px-2 py-2">
                    Base fee (₹)
                  </th>
                  <th className="border border-[#e0e0e0] px-2 py-2">Notes</th>
                  <th className="border border-[#e0e0e0] px-2 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {examRows.map((r) => (
                  <tr key={r.exam}>
                    <td className="border border-[#e0e0e0] px-2 py-2 font-semibold text-[#212121]">
                      {targetCourseLabel(r.exam)}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        className="w-32 rounded-none border border-[#e0e0e0] px-2 py-1 tabular-nums"
                        value={r.baseFee}
                        onChange={(e) =>
                          updateExamBaseFee(
                            r.exam,
                            Math.max(0, Math.round(Number(e.target.value) || 0)),
                          )
                        }
                        aria-label={`Base fee for ${targetCourseLabel(r.exam)}`}
                      />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-2">
                      <input
                        type="text"
                        className="w-full min-w-[160px] max-w-md rounded-none border border-[#e0e0e0] px-2 py-1"
                        placeholder="Optional"
                        value={r.notes}
                        onChange={(e) => updateExamNotes(r.exam, e.target.value)}
                      />
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-2 text-xs text-[#9e9e9e]">
                      {r.updatedAt
                        ? new Date(r.updatedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-[#212121]">Fee Management</h1>
          <button
            type="button"
            className="rounded-none border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#424242]"
            onClick={() => {
              document
                .getElementById("exam-fee-defaults")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Exam defaults
          </button>
        </div>

        {error && (
          <p className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="text-sm text-[#757575]">Loading fees…</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Revenue", `₹${totals.totalRev.toLocaleString("en-IN")}`, "text-[#1565c0]"],
            ["Collected", `₹${totals.collected.toLocaleString("en-IN")}`, "text-[#2e7d32]"],
            ["Pending", `₹${totals.pending.toLocaleString("en-IN")}`, "text-[#f57f17]"],
            ["This Month", `₹${totals.month.toLocaleString("en-IN")}`, "text-[#212121]"],
          ].map(([label, val, c]) => (
            <div
              key={label}
              className="rounded-none border border-[#e0e0e0] bg-white p-4"
            >
              <p className="text-xs text-[#757575]">{label}</p>
              <p className={`mt-1 text-lg font-bold ${c}`}>{val}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-none border border-[#e0e0e0] px-3 py-2 text-sm"
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
            className="rounded-none border border-[#e0e0e0] px-3 py-2 text-sm"
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
          >
            <option value="">All courses</option>
            {targetCourseOptions.map((c) => (
              <option key={c} value={c}>
                {targetCourseLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-auto rounded-none border border-[#e0e0e0]">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-[#f8f9fa] text-left text-xs uppercase text-[#757575]">
                <th className="border-b border-[#e0e0e0] px-2 py-2">#</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Student</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">
                  Target exam
                </th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Total</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Discount</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Final</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Paid</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Balance</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">EMI</th>
                <th className="border-b border-[#e0e0e0] px-2 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="min-h-[40px] hover:bg-[#f5f5f5]">
                  <td className="border-b border-[#e0e0e0] px-2 py-2">{i + 1}</td>
                  <td className="border-b border-[#e0e0e0] px-2 py-2">{r.student}</td>
                  <td className="border-b border-[#e0e0e0] px-2 py-2">
                    {targetCourseLabel(r.course) || r.course || "—"}
                  </td>
                  <td className="border-b border-[#e0e0e0] px-2 py-2">
                    ₹{r.total.toLocaleString("en-IN")}
                  </td>
                  <td className="border-b border-[#e0e0e0] px-2 py-2">
                    <input
                      type="number"
                      className="w-14 rounded-none border border-[#e0e0e0] px-1"
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
                      className={`rounded-none px-2 py-0.5 text-xs font-medium ${badge(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#757575]">
          Fee records from database: {rows.length} row{rows.length === 1 ? "" : "s"}.
          {leadCount != null ? ` Leads in system: ${leadCount}.` : ""}
        </p>
      </div>
    </div>
  );
}
