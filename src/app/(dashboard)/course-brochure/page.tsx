"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";

type TemplateRow = {
  exam: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  updatedAt?: string | null;
};

export default function CourseBrochurePage() {
  const [rows, setRows] = useState<TemplateRow[]>(() =>
    TARGET_EXAM_OPTIONS.map((exam) => ({
      exam,
      title: "",
      summary: "",
      linkUrl: "",
      linkLabel: "",
    })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/exam-brochure-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load templates.");
      const data = (await res.json()) as TemplateRow[];
      if (Array.isArray(data) && data.length > 0) {
        setRows(
          TARGET_EXAM_OPTIONS.map((exam) => {
            const hit = data.find((d) => d.exam === exam);
            return {
              exam,
              title: hit?.title ?? "",
              summary: hit?.summary ?? "",
              linkUrl: hit?.linkUrl ?? "",
              linkLabel: hit?.linkLabel ?? "",
              updatedAt: hit?.updatedAt ?? null,
            };
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/exam-brochure-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows.map((r) => ({
            exam: r.exam,
            title: r.title,
            summary: r.summary,
            linkUrl: r.linkUrl,
            linkLabel: r.linkLabel,
          })),
        }),
      });
      if (!res.ok) throw new Error("Save failed.");
      const data = (await res.json()) as TemplateRow[];
      if (Array.isArray(data)) {
        setRows(
          TARGET_EXAM_OPTIONS.map((exam) => {
            const hit = data.find((d) => d.exam === exam);
            return {
              exam,
              title: hit?.title ?? "",
              summary: hit?.summary ?? "",
              linkUrl: hit?.linkUrl ?? "",
              linkLabel: hit?.linkLabel ?? "",
              updatedAt: hit?.updatedAt ?? null,
            };
          }),
        );
      }
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }, [rows]);

  const update = (exam: string, patch: Partial<TemplateRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.exam === exam ? { ...r, ...patch } : r)),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#212121]">Course Brochures</h1>
          <p className="mt-1 max-w-2xl text-sm text-[#757575]">
            Configure title, summary, and an optional PDF link per target exam.
            On each student&apos;s <strong>Step 2 · Course brochure</strong>, the
            row for their exam (e.g. NEET) appears automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-none border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#424242]"
          >
            Leads
          </Link>
          <button
            type="button"
            className="rounded-none bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={saving || loading}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save all"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-700" role="alert">
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {savedAt && (
        <p className="text-xs text-[#2e7d32]">
          Saved {new Date(savedAt).toLocaleString()}.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[#757575]">Loading brochure templates…</p>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <div
              key={r.exam}
              className="rounded-none border border-[#e0e0e0] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f0f0f0] pb-3">
                <h2 className="text-lg font-bold text-[#212121]">{r.exam}</h2>
                <span className="text-[11px] text-[#9e9e9e]">
                  {r.updatedAt
                    ? `Updated ${new Date(r.updatedAt).toLocaleString()}`
                    : "Not saved yet"}
                </span>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-[#424242]">Title</span>
                  <input
                    className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2"
                    placeholder={`e.g. ${r.exam} 2026 — Classroom + Online`}
                    value={r.title}
                    onChange={(e) => update(r.exam, { title: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-[#424242]">
                    PDF link label (optional)
                  </span>
                  <input
                    className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2"
                    placeholder="e.g. Download NEET brochure (PDF)"
                    value={r.linkLabel}
                    onChange={(e) => update(r.exam, { linkLabel: e.target.value })}
                  />
                </label>
              </div>
              <label className="mt-4 block text-sm">
                <span className="font-medium text-[#424242]">
                  PDF / document URL (optional)
                </span>
                <input
                  className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2 font-mono text-[13px]"
                  placeholder="https://…"
                  value={r.linkUrl}
                  onChange={(e) => update(r.exam, { linkUrl: e.target.value })}
                />
              </label>
              <label className="mt-4 block text-sm">
                <span className="font-medium text-[#424242]">
                  Summary (shown on student brochure step)
                </span>
                <textarea
                  rows={5}
                  className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2 text-[13px] leading-relaxed"
                  placeholder="Key bullets: batches, faculty, fee overview, contact…"
                  value={r.summary}
                  onChange={(e) => update(r.exam, { summary: e.target.value })}
                />
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
