"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LEAD_SOURCE_OPTIONS,
  normalizeLeadSources,
  type LeadSourceOption,
} from "@/lib/leadSources";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

export default function LeadSourcesSettingsPage() {
  const [sources, setSources] = useState<LeadSourceOption[]>(() =>
    DEFAULT_LEAD_SOURCE_OPTIONS.map((o) => ({ ...o })),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/lead-sources", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Load failed");
      const data = (await res.json()) as { sources?: unknown };
      setSources(normalizeLeadSources(data.sources));
    } catch {
      setError("Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/lead-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Save failed.",
        );
        return;
      }
      setSources(normalizeLeadSources(data.sources));
      setMessage("Saved.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = async () => {
    if (
      !window.confirm(
        "Reset lead sources to the built-in defaults (OL/WT/REF/PD)?",
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/settings/lead-sources", {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Reset failed.",
        );
        return;
      }
      setSources(normalizeLeadSources(data.sources));
      setMessage("Restored defaults.");
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const updateRow = (
    index: number,
    field: keyof LeadSourceOption,
    value: string,
  ) => {
    setSources((prev) => {
      const next = [...prev];
      const row = { ...next[index]! };
      if (field === "abbrev") row.abbrev = value.toUpperCase().slice(0, 8);
      else if (field === "label") row.label = value.slice(0, 64);
      else row.value = value.slice(0, 64);
      next[index] = row;
      return next;
    });
    setMessage(null);
  };

  const addRow = () => {
    setSources((prev) => [
      ...prev,
      { abbrev: "XX", label: "New source", value: "New source" },
    ]);
    setMessage(null);
  };

  const removeRow = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
  };

  const field =
    "mt-1 w-full rounded-none border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25";

  return (
    <div className={cn(SX.pageWrap, "max-w-3xl")}>
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Lead sources
        </h1>
        <p className="mt-1 text-[13px] text-slate-600">
          Abbreviations (e.g. OL, WT) appear in the lead sheet. Stored value is
          saved on each lead and used in exports. Changes apply after save.
        </p>
      </header>

      {loading ? (
        <p className="text-[13px] text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-none border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2.5">Abbrev</th>
                  <th className="px-3 py-2.5">Label</th>
                  <th className="px-3 py-2.5">Stored value</th>
                  <th className="w-14 px-2 py-2.5 text-center" />
                </tr>
              </thead>
              <tbody>
                {sources.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-2 align-top">
                      <input
                        className={cn(field, "font-mono tabular-nums uppercase")}
                        value={row.abbrev}
                        onChange={(e) =>
                          updateRow(i, "abbrev", e.target.value)
                        }
                        maxLength={8}
                        aria-label={`Source ${i + 1} abbreviation`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        className={field}
                        value={row.label}
                        onChange={(e) =>
                          updateRow(i, "label", e.target.value)
                        }
                        aria-label={`Source ${i + 1} label`}
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        className={field}
                        value={row.value}
                        onChange={(e) =>
                          updateRow(i, "value", e.target.value)
                        }
                        aria-label={`Source ${i + 1} stored value`}
                      />
                    </td>
                    <td className="px-2 py-2 align-top text-center">
                      <button
                        type="button"
                        className="text-[12px] font-medium text-rose-700 hover:underline disabled:opacity-40"
                        disabled={sources.length <= 1}
                        onClick={() => removeRow(i)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(SX.btnSecondary, "text-[13px]")}
              onClick={addRow}
            >
              Add source
            </button>
          </div>

          {error && (
            <p className="mt-3 text-[13px] text-rose-700" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="mt-3 text-[13px] text-emerald-800" role="status">
              {message}
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              className={cn(SX.btnPrimary, "px-4 py-2 text-[13px]")}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className={cn(SX.btnSecondary, "px-4 py-2 text-[13px]")}
              disabled={saving}
              onClick={() => void resetDefaults()}
            >
              Reset to defaults
            </button>
          </div>
        </>
      )}
    </div>
  );
}
