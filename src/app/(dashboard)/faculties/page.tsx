"use client";

import { useState } from "react";
import { FACULTY_SEED } from "@/lib/mock-data";

export default function FacultiesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Faculty Management</h1>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
        >
          + Add Faculty
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {FACULTY_SEED.map((f) => (
          <article
            key={f.id}
            className="rounded-none border border-[#e0e0e0] bg-white p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-[#1565c0] text-lg font-semibold text-white">
                {f.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-[#212121]">{f.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1">
                  {f.subjects.map((s) => (
                    <span
                      key={s}
                      className="rounded-none bg-[#e3f2fd] px-2 py-0.5 text-xs text-[#1565c0]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm text-[#757575]">{f.phone}</p>
                <p className="text-sm text-[#757575]">{f.email}</p>
                <span className="mt-2 inline-block rounded-none bg-[#e8f5e9] px-2 py-0.5 text-xs text-[#2e7d32]">
                  {f.active ? "Active" : "Inactive"}
                </span>
                <div className="mt-4 flex gap-3 text-sm">
                  <button type="button" className="text-[#1565c0] underline">
                    Edit
                  </button>
                  <button type="button" className="text-[#c62828] underline">
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div
            role="dialog"
            aria-modal="true"
            className="h-full w-full max-w-md overflow-y-auto border-l border-[#e0e0e0] bg-white p-6 shadow-none"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Faculty</h2>
              <button
                type="button"
                className="text-[#757575]"
                onClick={() => setDrawerOpen(false)}
              >
                ✕
              </button>
            </div>
            <form
              className="mt-6 space-y-4 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setDrawerOpen(false);
              }}
            >
              <Field label="Name" />
              <Field label="Email" type="email" />
              <Field label="Phone" />
              <div>
                <span className="text-[#757575]">Subjects</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Biology", "Physics", "Chemistry", "Math"].map((s) => (
                    <label key={s} className="flex items-center gap-1">
                      <input type="checkbox" /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Qualification" />
              <Field label="Experience (years)" type="number" />
              <Field label="Joining Date" type="date" />
              <label>
                <span className="text-[#757575]">Status</span>
                <select className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2">
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </label>
              <button
                type="submit"
                className="w-full rounded-none bg-[#2e7d32] py-3 font-medium text-white"
              >
                Save
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  type = "text",
}: {
  label: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[#757575]">{label}</span>
      <input
        type={type}
        className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2"
      />
    </label>
  );
}
