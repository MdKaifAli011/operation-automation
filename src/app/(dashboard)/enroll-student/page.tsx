"use client";

import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

const ENROLLED = [
  {
    id: "Testprepkart-2026-0341",
    name: "Rahul Sharma",
    course: "NEET",
    batch: "2026-27",
    date: "03/04/2026",
    fee: "Paid",
  },
  {
    id: "Testprepkart-2026-0288",
    name: "Sneha Patel",
    course: "JEE",
    batch: "2026-27",
    date: "28/03/2026",
    fee: "Partial",
  },
  {
    id: "Testprepkart-2026-0192",
    name: "Aryan Mehta",
    course: "CUET",
    batch: "2025-26",
    date: "15/02/2026",
    fee: "Paid",
  },
];

export default function EnrollStudentPage() {
  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Enrolled students</h1>
            <p className={SX.toolbarMeta}>
              Admissions linked to fee and batches — same workbook style as leads
            </p>
          </div>
        </div>

        <div className={SX.leadStatBar}>
          <span className="text-slate-600">
            <strong className="font-semibold text-slate-800">
              {ENROLLED.length}
            </strong>{" "}
            enrolled in view
          </span>
        </div>

        <div className="grid gap-3 border-b border-slate-200/90 bg-white px-3 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:px-4">
          {(
            [
              ["Total enrolled", "340", "text-primary"],
              ["This month", "28", "text-emerald-600"],
              ["NEET", "180", "text-slate-800"],
              ["JEE", "120", "text-slate-800"],
              ["CUET", "40", "text-slate-800"],
            ] as const
          ).map(([label, val, accent]) => (
            <div
              key={label}
              className="rounded-none border border-slate-200/90 bg-slate-50/50 px-3 py-3 text-center shadow-sm"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {label}
              </p>
              <p className={cn("mt-1 text-xl font-bold tabular-nums", accent)}>
                {val}
              </p>
            </div>
          ))}
        </div>

        <div className="border-b border-slate-200/90 bg-white px-3 py-3 sm:px-4">
          <h2 className="text-[13px] font-bold text-slate-800">All enrolled</h2>
          <p className="text-[12px] text-slate-500">
            Enrollment ID, course, batch, and fee status
          </p>
        </div>

        <div className="overflow-x-auto bg-white p-2 sm:p-4">
          <table className={cn(SX.dataTable, "min-w-[800px]")}>
            <thead>
              <tr>
                <th className={SX.dataTh}>#</th>
                <th className={SX.dataTh}>Enrollment ID</th>
                <th className={SX.dataTh}>Student</th>
                <th className={SX.dataTh}>Course</th>
                <th className={SX.dataTh}>Batch</th>
                <th className={SX.dataTh}>Date</th>
                <th className={SX.dataTh}>Fee</th>
                <th className={SX.dataTh}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {ENROLLED.map((r, i) => (
                <tr key={r.id}>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                    {i + 1}
                  </td>
                  <td
                    className={cn(
                      SX.dataTd,
                      i % 2 === 1 && SX.zebraRow,
                      "font-mono text-[12px]",
                    )}
                  >
                    {r.id}
                  </td>
                  <td
                    className={cn(
                      SX.dataTd,
                      i % 2 === 1 && SX.zebraRow,
                      "font-medium",
                    )}
                  >
                    {r.name}
                  </td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                    <span className="rounded-none bg-sky-50 px-2 py-0.5 text-[12px] font-medium text-primary">
                      {r.course}
                    </span>
                  </td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                    {r.batch}
                  </td>
                  <td
                    className={cn(
                      SX.dataTd,
                      i % 2 === 1 && SX.zebraRow,
                      "tabular-nums",
                    )}
                  >
                    {r.date}
                  </td>
                  <td className={cn(SX.dataTd, i % 2 === 1 && SX.zebraRow)}>
                    <span
                      className={cn(
                        "rounded-none px-2 py-0.5 text-[11px] font-semibold",
                        r.fee === "Paid"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-900",
                      )}
                    >
                      {r.fee}
                    </span>
                  </td>
                  <td
                    className={cn(
                      SX.dataTd,
                      i % 2 === 1 && SX.zebraRow,
                      "text-primary",
                    )}
                  >
                    <button type="button" className="font-medium hover:underline">
                      View
                    </button>
                    <span className="text-slate-300"> · </span>
                    <button type="button" className="font-medium hover:underline">
                      Edit
                    </button>
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
