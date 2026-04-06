"use client";

import Link from "next/link";
import { useState } from "react";

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
          About brochures
        </button>
      </div>

      <div className="rounded-none border border-[#e0e0e0] bg-[#f8f9fa] px-4 py-10 text-center text-sm text-[#424242]">
        <p className="font-medium text-[#212121]">No global brochure library yet</p>
        <p className="mx-auto mt-2 max-w-lg text-[#757575]">
          Brochure notes and send status for each student are stored on the lead in
          MongoDB (pipeline step 2). Open a student from the main sheet to generate
          or track brochure sends there.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block font-medium text-[#1565c0] underline"
        >
          Go to leads
        </Link>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#e0e0e0] bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Brochures</h2>
              <button type="button" onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#424242]">
              A shared brochure catalog with uploads is not wired to the database
              yet. Per-student brochure workflow lives under each lead&apos;s student
              detail page.
            </p>
            <button
              type="button"
              className="mt-6 w-full rounded-none bg-[#2e7d32] py-3 text-white"
              onClick={() => setDrawer(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
