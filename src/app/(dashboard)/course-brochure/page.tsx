"use client";

import { useState } from "react";

const BROCHURES = [
  { id: "1", course: "NEET", name: "NEET 2026", date: "01 Mar 2026", ver: "v2" },
  { id: "2", course: "JEE", name: "JEE 2026", date: "15 Feb 2026", ver: "v2" },
  { id: "3", course: "CUET", name: "CUET 2026", date: "20 Jan 2026", ver: "v1" },
];

export default function CourseBrochurePage() {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Course Brochures</h1>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
        >
          + Upload Brochure
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BROCHURES.map((b) => (
          <article
            key={b.id}
            className="rounded-none border border-[#e0e0e0] bg-white p-4"
          >
            <div className="flex h-32 items-center justify-center rounded-none bg-[#f8f9fa] text-4xl text-[#757575]">
              📄
            </div>
            <h2 className="mt-3 font-bold text-[#212121]">{b.course}</h2>
            <p className="text-sm text-[#757575]">{b.name}</p>
            <p className="text-xs text-[#757575]">Uploaded {b.date}</p>
            <p className="text-xs font-medium text-[#1565c0]">{b.ver}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button type="button" className="text-[#1565c0] underline">
                Preview
              </button>
              <button type="button" className="text-[#1565c0] underline">
                Download
              </button>
              <button type="button" className="text-[#2e7d32] underline">
                Set as Default
              </button>
              <button type="button" className="text-[#c62828] underline">
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#e0e0e0] bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Upload Brochure</h2>
              <button type="button" onClick={() => setDrawer(false)}>✕</button>
            </div>
            <form
              className="mt-6 space-y-3 text-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setDrawer(false);
              }}
            >
              <label className="block">
                Course
                <select className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2">
                  <option>NEET</option>
                  <option>JEE</option>
                  <option>CUET</option>
                </select>
              </label>
              <label className="block">
                Brochure Name
                <input className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2" />
              </label>
              <label className="block">
                File
                <input type="file" accept=".pdf,image/*" className="mt-1" />
              </label>
              <label className="block">
                Version
                <input className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2" />
              </label>
              <label className="block">
                Notes
                <textarea rows={2} className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2" />
              </label>
              <button
                type="submit"
                className="w-full rounded-none bg-[#2e7d32] py-3 text-white"
              >
                Upload
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
