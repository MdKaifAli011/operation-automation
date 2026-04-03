"use client";

import { useState } from "react";

const SUBJECTS = [
  { id: "1", name: "Biology", course: "NEET", faculty: "Dr. Meena Singh", demo: true },
  { id: "2", name: "Physics", course: "NEET, JEE", faculty: "Mr. Ravi Kumar", demo: true },
  { id: "3", name: "Chemistry", course: "NEET, JEE", faculty: "Dr. Meena Singh", demo: true },
  { id: "4", name: "Mathematics", course: "JEE", faculty: "Mr. Arjun Das", demo: true },
  { id: "5", name: "English", course: "CUET", faculty: "Ms. Priya Sharma", demo: false },
];

export default function SubjectsPage() {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Subject Management</h1>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="rounded-[6px] bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
        >
          + Add Subject
        </button>
      </div>

      <div className="overflow-auto rounded-[6px] border border-[#e0e0e0]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8f9fa] text-left text-xs uppercase">
              <th className="border border-[#e0e0e0] px-2 py-2">#</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Subject</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Course</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Faculty</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Demo</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {SUBJECTS.map((s) => (
              <tr key={s.id} className="min-h-[40px]">
                <td className="border border-[#e0e0e0] px-2 py-2">{s.id}</td>
                <td className="border border-[#e0e0e0] px-2 py-2 font-medium">{s.name}</td>
                <td className="border border-[#e0e0e0] px-2 py-2">{s.course}</td>
                <td className="border border-[#e0e0e0] px-2 py-2">{s.faculty}</td>
                <td className="border border-[#e0e0e0] px-2 py-2">
                  {s.demo ? "Yes" : "No"}
                </td>
                <td className="border border-[#e0e0e0] px-2 py-2 text-[#1565c0]">
                  Edit / Delete
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#e0e0e0] bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Add Subject</h2>
              <button type="button" onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <form
              className="mt-6 space-y-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setDrawer(false);
              }}
            >
              <label className="block">
                Subject Name
                <input className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2" />
              </label>
              <label className="block">
                Linked courses
                <div className="mt-2 flex flex-wrap gap-2">
                  {["NEET", "JEE", "CUET"].map((c) => (
                    <label key={c} className="flex items-center gap-1">
                      <input type="checkbox" /> {c}
                    </label>
                  ))}
                </div>
              </label>
              <label className="block">
                Faculty
                <select className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2">
                  <option>Dr. Meena Singh</option>
                  <option>Mr. Ravi Kumar</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked /> Demo available
              </label>
              <label className="block">
                Description
                <textarea rows={3} className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-3 py-2" />
              </label>
              <button
                type="submit"
                className="w-full rounded-[6px] bg-[#2e7d32] py-3 text-white"
              >
                Save Subject
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
