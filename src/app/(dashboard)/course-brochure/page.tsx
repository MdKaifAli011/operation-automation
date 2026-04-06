"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrochureInlinePreviewFrame } from "@/components/brochure/BrochureInlinePreviewFrame";
import { IconCloudUpload } from "@/components/icons/CrmIcons";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import { normalizeBrochurePreviewUrl } from "@/lib/brochurePreview";

type TemplateRow = {
  exam: string;
  title: string;
  summary: string;
  linkUrl: string;
  linkLabel: string;
  storedFileUrl: string | null;
  storedFileName: string | null;
  updatedAt?: string | null;
};

function emptyRow(exam: string): TemplateRow {
  return {
    exam,
    title: "",
    summary: "",
    linkUrl: "",
    linkLabel: "",
    storedFileUrl: null,
    storedFileName: null,
  };
}

export default function CourseBrochurePage() {
  const [rows, setRows] = useState<TemplateRow[]>(() =>
    TARGET_EXAM_OPTIONS.map((exam) => emptyRow(exam)),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const uploadBusyExam = useRef<string | null>(null);

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
              storedFileUrl: hit?.storedFileUrl ?? null,
              storedFileName: hit?.storedFileName ?? null,
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
            storedFileUrl: r.storedFileUrl,
            storedFileName: r.storedFileName,
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
              storedFileUrl: hit?.storedFileUrl ?? null,
              storedFileName: hit?.storedFileName ?? null,
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
            Upload a brochure file (PDF, image, Office, etc.) or paste a link per
            exam. Students see this as the default on{" "}
            <strong>Step 2 · Course brochure</strong> until a file is uploaded
            for that lead.
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
        <div className="space-y-8">
          {rows.map((r) => (
            <ExamBrochureCard key={r.exam} row={r} onUpdate={update} />
          ))}
        </div>
      )}
    </div>
  );
}

function ExamBrochureCard({
  row: r,
  onUpdate,
}: {
  row: TemplateRow;
  onUpdate: (exam: string, patch: Partial<TemplateRow>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewSrc = useMemo(() => {
    const raw = r.storedFileUrl?.trim() || r.linkUrl?.trim();
    if (!raw) return "";
    return normalizeBrochurePreviewUrl(raw);
  }, [r.storedFileUrl, r.linkUrl]);

  const previewLabel = useMemo(() => {
    if (r.storedFileUrl?.trim()) {
      return r.storedFileName?.trim() || r.title.trim() || `${r.exam} brochure`;
    }
    if (r.linkUrl.trim()) {
      return r.linkLabel.trim() || r.title.trim() || `${r.exam} brochure`;
    }
    return `${r.exam} brochure`;
  }, [r]);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setLocalError(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(
        `/api/exam-brochure-templates/${encodeURIComponent(r.exam)}/upload`,
        { method: "POST", body: fd },
      );
      const data = (await res.json().catch(() => ({}))) as {
        storedFileUrl?: string;
        storedFileName?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (!data.storedFileUrl) throw new Error("Invalid response");
      onUpdate(r.exam, {
        storedFileUrl: data.storedFileUrl,
        storedFileName: data.storedFileName ?? null,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemoveFile = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/exam-brochure-templates/${encodeURIComponent(r.exam)}/upload`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Could not remove file");
      onUpdate(r.exam, {
        storedFileUrl: null,
        storedFileName: null,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#e0e0e0] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#f0f0f0] pb-3">
        <h2 className="text-lg font-bold text-[#212121]">{r.exam}</h2>
        <span className="text-[11px] text-[#9e9e9e]">
          {r.updatedAt
            ? `Updated ${new Date(r.updatedAt).toLocaleString()}`
            : "Not saved yet"}
        </span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#757575]">
            Preview
          </p>
          {previewSrc ? (
            <BrochureInlinePreviewFrame src={previewSrc} fileLabel={previewLabel} />
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-[#e0e0e0] bg-[#fafafa] px-4 text-center text-sm text-[#757575]">
              Upload a file or add a document URL — preview appears here.
            </div>
          )}
          {r.storedFileUrl ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#616161]">
              <span className="truncate">
                File:{" "}
                <span className="font-medium text-[#212121]">
                  {r.storedFileName ?? "Uploaded"}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                className="rounded border border-rose-200 bg-rose-50 px-2.5 py-1 text-[12px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                onClick={() => void onRemoveFile()}
              >
                Remove file
              </button>
            </div>
          ) : r.linkUrl.trim() && !r.storedFileUrl ? (
            <p className="text-[12px] text-[#757575]">
              Preview from <span className="font-medium">PDF / document URL</span>{" "}
              (right column). Uploading a file replaces the link for preview.
            </p>
          ) : null}

          <div>
            <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#bdbdbd] bg-[#fafafa] px-4 py-6 text-center text-[13px] text-[#616161]">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={busy}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,image/*"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
              <IconCloudUpload className="h-8 w-8 text-[#9e9e9e]" />
              <span>{busy ? "Uploading…" : "Upload brochure file"}</span>
              <span className="text-[11px] text-[#9e9e9e]">
                PDF, images, Word, Excel, PowerPoint, text · max 25 MB
              </span>
            </label>
            {localError ? (
              <p className="mt-2 text-[12px] text-rose-700">{localError}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-[#424242]">Title</span>
            <input
              className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2"
              placeholder={`e.g. ${r.exam} 2026 — Classroom + Online`}
              value={r.title}
              onChange={(e) => onUpdate(r.exam, { title: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#424242]">
              Link label (optional)
            </span>
            <input
              className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2"
              placeholder="e.g. Download brochure (PDF)"
              value={r.linkLabel}
              onChange={(e) => onUpdate(r.exam, { linkLabel: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#424242]">
              PDF / document URL (optional if you upload a file)
            </span>
            <input
              className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2 font-mono text-[13px]"
              placeholder="https://…"
              value={r.linkUrl}
              onChange={(e) => onUpdate(r.exam, { linkUrl: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[#424242]">
              Summary (shown on student brochure step)
            </span>
            <textarea
              rows={5}
              className="mt-1 w-full rounded-none border border-[#e0e0e0] px-3 py-2 text-[13px] leading-relaxed"
              placeholder="Key bullets: batches, faculty, fee overview, contact…"
              value={r.summary}
              onChange={(e) => onUpdate(r.exam, { summary: e.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
