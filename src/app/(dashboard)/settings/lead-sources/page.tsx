"use client";

import { format, parseISO } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import {
  normalizeLeadSources,
  type LeadSourceOption,
} from "@/lib/leadSources";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type LeadSourcesPayload = {
  sources: LeadSourceOption[];
  updatedAt: string | null;
};

const LEAD_SOURCES_PAGE_CACHE_TTL_MS = 60_000;
let leadSourcesPageCache: { data: LeadSourcesPayload; fetchedAt: number } | null =
  null;
let leadSourcesPageInFlight: Promise<LeadSourcesPayload> | null = null;

function hasFreshLeadSourcesPageCache() {
  if (!leadSourcesPageCache) return false;
  return Date.now() - leadSourcesPageCache.fetchedAt < LEAD_SOURCES_PAGE_CACHE_TTL_MS;
}

function writeLeadSourcesPageCache(data: LeadSourcesPayload) {
  leadSourcesPageCache = { data, fetchedAt: Date.now() };
}

async function fetchLeadSourcesPageFromApi() {
  const res = await fetch("/api/settings/lead-sources", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Load failed");
  const data = (await res.json()) as {
    sources?: unknown;
    updatedAt?: string | null;
  };
  return {
    sources: normalizeLeadSources(data.sources),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

async function getLeadSourcesPageCached(force = false) {
  if (!force && hasFreshLeadSourcesPageCache() && leadSourcesPageCache) {
    return leadSourcesPageCache.data;
  }
  if (!force && leadSourcesPageInFlight) return leadSourcesPageInFlight;
  leadSourcesPageInFlight = fetchLeadSourcesPageFromApi()
    .then((data) => {
      writeLeadSourcesPageCache(data);
      return data;
    })
    .finally(() => {
      leadSourcesPageInFlight = null;
    });
  return leadSourcesPageInFlight;
}

export default function LeadSourcesSettingsPage() {
  const [sources, setSources] = useState<LeadSourceOption[]>(
    () => leadSourcesPageCache?.data.sources ?? [],
  );
  const [loading, setLoading] = useState(() => !leadSourcesPageCache);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverUpdatedAt, setServerUpdatedAt] = useState<string | null>(
    () => leadSourcesPageCache?.data.updatedAt ?? null,
  );

  const applyPayload = useCallback((payload: LeadSourcesPayload) => {
    writeLeadSourcesPageCache(payload);
    setSources(payload.sources);
    setServerUpdatedAt(payload.updatedAt);
  }, []);

  const load = useCallback(async (opts?: { force?: boolean; showLoading?: boolean }) => {
    const force = opts?.force ?? false;
    const showLoading = opts?.showLoading ?? false;
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const payload = await getLeadSourcesPageCached(force);
      applyPayload(payload);
    } catch {
      setError("Could not load settings.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    if (hasFreshLeadSourcesPageCache() && leadSourcesPageCache) {
      applyPayload(leadSourcesPageCache.data);
      setLoading(false);
      return;
    }
    void load({ force: true, showLoading: !leadSourcesPageCache });
  }, [load, applyPayload]);

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
      const data = (await res.json()) as {
        sources?: unknown;
        error?: string;
        updatedAt?: string | null;
      };
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Save failed.",
        );
        return;
      }
      applyPayload({
        sources: normalizeLeadSources(data.sources),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      });
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
      const data = (await res.json()) as {
        sources?: unknown;
        error?: string;
        updatedAt?: string | null;
      };
      if (!res.ok) {
        setError(
          typeof data?.error === "string" ? data.error : "Reset failed.",
        );
        return;
      }
      applyPayload({
        sources: normalizeLeadSources(data.sources),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
      });
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
    setError(null);
  };

  const addRow = () => {
    setSources((prev) => [
      ...prev,
      { abbrev: "XX", label: "New source", value: "New source" },
    ]);
    setMessage(null);
    setError(null);
  };

  const removeRow = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index));
    setMessage(null);
    setError(null);
  };

  const lastSavedLabel =
    serverUpdatedAt &&
    (() => {
      try {
        return format(parseISO(serverUpdatedAt), "dd MMM yyyy, HH:mm");
      } catch {
        return null;
      }
    })();

  const statText = loading
    ? "Loading…"
    : error
      ? error
      : message
        ? message
        : lastSavedLabel
          ? `Last saved ${lastSavedLabel}`
          : "Edit rows, then Save · at least one source required";

  const busy = loading || saving;

  return (
    <div className={cn(SX.leadPageRoot, "gap-0 pb-6")}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Lead sources</h1>
            <p className={SX.toolbarMeta}>
              Sheet column abbreviations and stored{" "}
              <code className="rounded-none bg-slate-100 px-1 font-mono text-[11px] text-slate-800">
                dataType
              </code>{" "}
              on each lead.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={busy}
              onClick={addRow}
            >
              Add source
            </button>
            <button
              type="button"
              className={SX.btnSecondary}
              disabled={busy}
              onClick={() => void resetDefaults()}
            >
              Reset defaults
            </button>
            <button
              type="button"
              className={SX.leadBtnGreen}
              disabled={busy}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            error && "bg-rose-50/80 text-rose-900",
            !error && message && "bg-emerald-50/50 text-emerald-900",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 font-medium",
              !error && !message && "font-normal text-slate-600",
            )}
            role={error ? "alert" : message ? "status" : undefined}
          >
            {statText}
          </span>
          {!loading ? (
            <span className="shrink-0 tabular-nums text-slate-500">
              {sources.length} row{sources.length !== 1 ? "s" : ""}
            </span>
          ) : null}
        </div>

        {!loading ? (
          <div className="overflow-x-auto border-b border-slate-200 bg-white">
            <table
              className={cn(SX.dataTable, "w-full min-w-[min(100%,520px)]")}
            >
              <colgroup>
                <col className="w-[5.5rem]" />
                <col />
                <col />
                <col className="w-[4.5rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th className={cn(SX.dataTh, "py-1.5")}>Abbrev</th>
                  <th className={cn(SX.dataTh, "py-1.5")}>Label</th>
                  <th className={cn(SX.dataTh, "py-1.5")}>Stored value</th>
                  <th className={cn(SX.dataTh, "py-1.5 text-center")}>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 1 ? SX.zebraRow : undefined}
                  >
                    <td className={cn(SX.dataTd, "p-1 align-middle")}>
                      <input
                        className={cn(
                          SX.input,
                          "h-8 font-mono text-[12px] uppercase tabular-nums",
                        )}
                        value={row.abbrev}
                        onChange={(e) =>
                          updateRow(i, "abbrev", e.target.value)
                        }
                        maxLength={8}
                        aria-label={`Source ${i + 1} abbreviation`}
                      />
                    </td>
                    <td className={cn(SX.dataTd, "p-1 align-middle")}>
                      <input
                        className={cn(SX.input, "h-8 text-[12px]")}
                        value={row.label}
                        onChange={(e) =>
                          updateRow(i, "label", e.target.value)
                        }
                        aria-label={`Source ${i + 1} label`}
                      />
                    </td>
                    <td className={cn(SX.dataTd, "p-1 align-middle")}>
                      <input
                        className={cn(SX.input, "h-8 text-[12px]")}
                        value={row.value}
                        onChange={(e) =>
                          updateRow(i, "value", e.target.value)
                        }
                        aria-label={`Source ${i + 1} stored value`}
                      />
                    </td>
                    <td className={cn(SX.dataTd, "p-1 text-center align-middle")}>
                      <button
                        type="button"
                        className={cn(
                          SX.btnGhost,
                          "px-1.5 py-0.5 text-[11px] text-rose-700 hover:text-rose-900",
                        )}
                        disabled={sources.length <= 1 || busy}
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
        ) : null}

        {!loading ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 bg-[#fafafa] px-3 py-2 text-[11px] leading-tight text-slate-600">
            <span>
              Changing stored values affects new picks only — existing leads keep
              their saved value until edited.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
