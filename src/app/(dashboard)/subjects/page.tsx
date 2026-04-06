"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Faculty } from "@/lib/types";

export default function SubjectsPage() {
  const [drawer, setDrawer] = useState(false);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/faculties");
      if (!res.ok) throw new Error("Could not load faculties.");
      const data = (await res.json()) as Faculty[];
      setFaculties(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setFaculties([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const out: {
      key: string;
      subject: string;
      faculty: string;
      active: boolean;
    }[] = [];
    for (const f of faculties) {
      for (const s of f.subjects ?? []) {
        const subj = String(s).trim();
        if (!subj) continue;
        out.push({
          key: `${f.id}:${subj}`,
          subject: subj,
          faculty: f.name,
          active: f.active,
        });
      }
    }
    return out.sort((a, b) => {
      const c = a.subject.localeCompare(b.subject);
      return c !== 0 ? c : a.faculty.localeCompare(b.faculty);
    });
  }, [faculties]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#212121]">Subject Management</h1>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white"
        >
          How to add subjects
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void load()}
          >
            Retry
          </button>
        </p>
      ) : null}

      <div className="overflow-auto rounded-none border border-[#e0e0e0]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8f9fa] text-left text-xs uppercase">
              <th className="border border-[#e0e0e0] px-2 py-2">#</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Subject</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Course</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Faculty</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Active</th>
              <th className="border border-[#e0e0e0] px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  className="border border-[#e0e0e0] px-2 py-4 text-[#757575]"
                  colSpan={6}
                >
                  Loading subjects from faculty records…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  className="border border-[#e0e0e0] px-2 py-4 text-[#757575]"
                  colSpan={6}
                >
                  No subjects yet. Add subjects to each faculty on the Faculties
                  page.
                </td>
              </tr>
            ) : (
              rows.map((s, i) => (
                <tr key={s.key} className="min-h-[40px]">
                  <td className="border border-[#e0e0e0] px-2 py-2">{i + 1}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2 font-medium">
                    {s.subject}
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2 text-[#757575]">
                    —
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2">{s.faculty}</td>
                  <td className="border border-[#e0e0e0] px-2 py-2">
                    {s.active ? "Yes" : "No"}
                  </td>
                  <td className="border border-[#e0e0e0] px-2 py-2 text-[#1565c0]">
                    <Link
                      href="/faculties"
                      className="font-medium hover:underline"
                    >
                      Edit faculty
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-[#e0e0e0] bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Subjects</h2>
              <button type="button" onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#424242]">
              Subjects are stored on each faculty record in MongoDB. Open{" "}
              <Link href="/faculties" className="font-medium text-[#1565c0] underline">
                Faculties
              </Link>{" "}
              to add or edit the subject list for a teacher.
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
