"use client";

import { addDays, format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, SortDir, SortKey } from "@/lib/types";
import { AddStudentLeadDialog } from "./AddStudentLeadDialog";
import { ExportLeadsDialog } from "./ExportLeadsDialog";
import { LeadSheetActionsMenu } from "./LeadSheetActionsMenu";
import { FollowUpDialog } from "./FollowUpDialog";
import {
  ImportExcelControl,
  type ImportExcelControlHandle,
} from "./ImportExcelControl";
import { LeadSheetTable } from "./LeadSheetTable";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { isLeadConvertedInCurrentMonth, getLeadConversionReferenceIso } from "@/lib/leadConversionMonth";
import {
  isLeadInOngoingPipeline,
  isLeadInNewDailyView,
} from "@/lib/leadSheetRouting";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";

type LeadMainTab = "ongoing" | "not_interested" | "followup" | "converted";

const LEADS_CACHE_TTL_MS = 60_000;
let leadsCache: { data: Lead[]; fetchedAt: number } | null = null;
let leadsInFlight: Promise<Lead[]> | null = null;

function hasFreshLeadsCache() {
  if (!leadsCache) return false;
  return Date.now() - leadsCache.fetchedAt < LEADS_CACHE_TTL_MS;
}

function writeLeadsCache(data: Lead[]) {
  leadsCache = { data, fetchedAt: Date.now() };
}

async function fetchLeadsFromApi(): Promise<Lead[]> {
  const res = await fetch("/api/leads", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load leads",
    );
  }
  return (await res.json()) as Lead[];
}

async function getLeadsCached(force = false): Promise<Lead[]> {
  if (!force && hasFreshLeadsCache() && leadsCache) {
    return leadsCache.data;
  }
  if (!force && leadsInFlight) return leadsInFlight;

  leadsInFlight = fetchLeadsFromApi()
    .then((data) => {
      writeLeadsCache(data);
      return data;
    })
    .finally(() => {
      leadsInFlight = null;
    });
  return leadsInFlight;
}

function sortLeads(list: Lead[], key: SortKey, dir: SortDir): Lead[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === "date") {
      cmp = a.date.localeCompare(b.date);
    } else if (key === "studentName") {
      cmp = a.studentName.localeCompare(b.studentName);
    } else if (key === "targetExams") {
      cmp = [...a.targetExams]
        .sort()
        .join(",")
        .localeCompare([...b.targetExams].sort().join(","));
    } else if (key === "country") {
      cmp = a.country.localeCompare(b.country);
    } else if (key === "rowTone") {
      cmp = a.rowTone.localeCompare(b.rowTone);
    }
    return cmp * mul;
  });
}

export function LeadManagementPage() {
  const [leads, setLeads] = useState<Lead[]>(() => leadsCache?.data ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !leadsCache);
  const [mainTab, setMainTab] = useState<LeadMainTab>("ongoing");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [followUpId, setFollowUpId] = useState<string | null>(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [sheetEditMode, setSheetEditMode] = useState(false);
  const [leadDraft, setLeadDraft] = useState<Record<string, Partial<Lead>>>({});
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [convertedMonthFilter, setConvertedMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [convertedNameSearch, setConvertedNameSearch] = useState("");
  const importExcelRef = useRef<ImportExcelControlHandle>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const leadSources = useLeadSources();
  const { activeValues: targetExamFilterOptions, labelFor: targetExamLabel } =
    useTargetExamOptions();

  /** Configured exams plus any values present on imported/custom leads. */
  const leadExamFilterOptions = useMemo(() => {
    const set = new Set<string>(targetExamFilterOptions);
    for (const l of leads) {
      for (const e of l.targetExams ?? []) {
        if (typeof e === "string" && e.trim()) set.add(e.trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [leads, targetExamFilterOptions]);

  const setLeadsAndCache = useCallback((next: Lead[]) => {
    writeLeadsCache(next);
    setLeads(next);
  }, []);

  const updateLeadsAndCache = useCallback((updater: (prev: Lead[]) => Lead[]) => {
    setLeads((prev) => {
      const next = updater(prev);
      writeLeadsCache(next);
      return next;
    });
  }, []);

  const refreshLeads = useCallback(
    async (opts?: { force?: boolean; showLoading?: boolean }) => {
      const force = opts?.force ?? false;
      const showLoading = opts?.showLoading ?? false;
      if (showLoading) setLoading(true);
      try {
        const data = await getLeadsCached(force);
        setLeadsAndCache(data);
        setLoadError(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [setLeadsAndCache],
  );

  useEffect(() => {
    let cancelled = false;
    if (hasFreshLeadsCache() && leadsCache) {
      setLeadsAndCache(leadsCache.data);
      setLoading(false);
      setLoadError(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(!leadsCache);
    setLoadError(null);
    refreshLeads({ force: true, showLoading: !leadsCache })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Could not load leads from API.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [refreshLeads, setLeadsAndCache]);

  useEffect(() => {
    if (!filterOpen && !sortOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      setFilterOpen(false);
      setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFilterOpen(false);
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen, sortOpen]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    const onFu = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>;
      setFollowUpId(ce.detail?.id ?? null);
    };
    window.addEventListener("lead-followup", onFu);
    return () => window.removeEventListener("lead-followup", onFu);
  }, []);

  const filtered = useMemo(() => {
    let list = leads;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const exams = l.targetExams.join(" ").toLowerCase();
        return (
          l.studentName.toLowerCase().includes(q) ||
          (l.email ?? "").toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          exams.includes(q) ||
          l.country.toLowerCase().includes(q) ||
          l.dataType.toLowerCase().includes(q) ||
          l.grade.toLowerCase().includes(q)
        );
      });
    }
    if (dateFrom) {
      list = list.filter((l) => l.date >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((l) => l.date <= dateTo);
    }
    if (filterCourse) {
      const want = filterCourse.trim().toLowerCase();
      list = list.filter((l) =>
        (l.targetExams ?? []).some(
          (e) => typeof e === "string" && e.trim().toLowerCase() === want,
        ),
      );
    }
    if (filterStatus) {
      list = list.filter((l) => l.rowTone === filterStatus);
    }
    return sortLeads(list, sortKey, sortDir);
  }, [
    leads,
    search,
    dateFrom,
    dateTo,
    filterCourse,
    filterStatus,
    sortKey,
    sortDir,
  ]);

  /** New & Daily · new intakes (status New) until marked Interested (first block on Ongoing tab). */
  const newAndDailyLeads = useMemo(
    () => filtered.filter(isLeadInNewDailyView),
    [filtered],
  );

  /** Ongoing tab · interested pipeline only (excludes New intakes above). */
  const ongoingSheetLeads = useMemo(
    () => filtered.filter(isLeadInOngoingPipeline),
    [filtered],
  );

  /** Ongoing tab · only Interested (Demo → Brochure → …). */
  const ongoingInterestedLeads = useMemo(
    () => {
      const interestedLeads = ongoingSheetLeads.filter((l) => l.rowTone === "interested");

      // Custom sorting with priority:
      // 1. Recently moved to Ongoing/Interested (top) - based on date when status changed
      // 2. Students yet to be scheduled for demo (middle) - no demo with status "Scheduled"
      // 3. Students in order of pipeline steps (bottom) - 4 steps total
      return interestedLeads.sort((a, b) => {
        const aUpdated = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bUpdated = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

        // Priority 1: Recently moved students (within last 24 hours)
        const aRecentlyMoved = aUpdated > oneDayAgo;
        const bRecentlyMoved = bUpdated > oneDayAgo;

        if (aRecentlyMoved && !bRecentlyMoved) return -1;
        if (!aRecentlyMoved && bRecentlyMoved) return 1;
        if (aRecentlyMoved && bRecentlyMoved) return bUpdated - aUpdated;

        // Priority 2: Students yet to be scheduled for demo
        // Check if there's any demo with status "Scheduled"
        const aDemoRows = (a.pipelineMeta as any)?.demo?.rows ?? [];
        const bDemoRows = (b.pipelineMeta as any)?.demo?.rows ?? [];

        const aHasScheduledDemo = aDemoRows.some((r: any) => r.status === "Scheduled");
        const bHasScheduledDemo = bDemoRows.some((r: any) => r.status === "Scheduled");

        if (!aHasScheduledDemo && bHasScheduledDemo) return -1;
        if (aHasScheduledDemo && !bHasScheduledDemo) return 1;

        // Priority 3: Students in order of pipeline steps (0-4)
        // Lower steps = less progress = higher priority
        if (a.pipelineSteps !== b.pipelineSteps) {
          return a.pipelineSteps - b.pipelineSteps;
        }

        // Final tie-breaker: most recently updated
        return bUpdated - aUpdated;
      });
    },
    [ongoingSheetLeads],
  );

  const followUpLeads = useMemo(
    () => filtered.filter((l) => l.sheetTab === "followup"),
    [filtered],
  );

  const notInterestedLeads = useMemo(
    () => filtered.filter((l) => l.sheetTab === "not_interested"),
    [filtered],
  );

  /** Converted · full pipeline (before month filter). */
  const convertedLeadsFullPipeline = useMemo(
    () =>
      filtered.filter(
        (l) => l.sheetTab === "converted" && l.pipelineSteps === 4,
      ),
    [filtered],
  );

  /** Converted tab: filtered by selected month/year and optional name search. */
  const convertedLeadsFiltered = useMemo(() => {
    let list = convertedLeadsFullPipeline;
    // Month/year filter
    if (convertedMonthFilter) {
      const [year, month] = convertedMonthFilter.split("-").map(Number);
      list = list.filter((l) => {
        const refIso = getLeadConversionReferenceIso(l);
        if (!refIso) return false;
        const d = new Date(refIso);
        if (Number.isNaN(d.getTime())) return false;
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      });
    }
    // Name search
    const q = convertedNameSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        l.studentName.toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        l.phone.includes(q),
      );
    }
    return list;
  }, [convertedLeadsFullPipeline, convertedMonthFilter, convertedNameSearch]);

  /** Stat count: current calendar month only. */
  const convertedLeadsThisMonth = useMemo(
    () =>
      convertedLeadsFullPipeline.filter((l) =>
        isLeadConvertedInCurrentMonth(l),
      ),
    [convertedLeadsFullPipeline],
  );

  const counts = useMemo(() => {
    const newDaily = leads.filter(isLeadInNewDailyView).length;
    const ongoingInterestedOnly = leads.filter(
      (l) => isLeadInOngoingPipeline(l) && l.rowTone === "interested",
    ).length;
    /** Ongoing tab: New & Daily + Interested pipeline only. */
    const ongoing = newDaily + ongoingInterestedOnly;
    const followup = leads.filter((l) => l.sheetTab === "followup").length;
    const notInterested = leads.filter(
      (l) => l.sheetTab === "not_interested",
    ).length;
    const converted = leads.filter((l) =>
      isLeadConvertedInCurrentMonth(l),
    ).length;
    return { ongoing, followup, notInterested, converted };
  }, [leads]);

  const onUpdateLead = useCallback(
    async (id: string, patch: Partial<Lead>) => {
      updateLeadsAndCache((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      );
      try {
        const res = await fetch(`/api/leads/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error();
        const updated = (await res.json()) as Lead;
        updateLeadsAndCache((prev) =>
          prev.map((l) => (l.id === id ? updated : l)),
        );
        setActionNotice("Lead updated.");
      } catch {
        try {
          await refreshLeads({ force: true });
        } catch {
          setLoadError("Could not sync with server.");
        }
      }
    },
    [refreshLeads, updateLeadsAndCache],
  );

  const onDraftPatch = useCallback((id: string, patch: Partial<Lead>) => {
    setLeadDraft((d) => ({
      ...d,
      [id]: { ...d[id], ...patch },
    }));
  }, []);

  const applyDraftToList = useCallback(
    (list: Lead[]) => list.map((l) => ({ ...l, ...(leadDraft[l.id] ?? {}) })),
    [leadDraft],
  );

  const hasSheetDraft = useMemo(
    () => Object.values(leadDraft).some((p) => p && Object.keys(p).length > 0),
    [leadDraft],
  );

  const saveSheetDraft = async () => {
    let changed = 0;
    for (const [id, patch] of Object.entries(leadDraft)) {
      if (patch && Object.keys(patch).length > 0) {
        await onUpdateLead(id, patch);
        changed += 1;
      }
    }
    setLeadDraft({});
    setSheetEditMode(false);
    if (changed > 0) {
      setActionNotice(`${changed} lead${changed === 1 ? "" : "s"} saved.`);
    }
  };

  const cancelSheetDraft = () => {
    setLeadDraft({});
    setSheetEditMode(false);
  };

  const tabCounts = useMemo(
    () => ({
      ongoing: newAndDailyLeads.length + ongoingInterestedLeads.length,
      not_interested: notInterestedLeads.length,
      followup: followUpLeads.length,
      converted: convertedLeadsThisMonth.length,
    }),
    [
      newAndDailyLeads.length,
      ongoingInterestedLeads.length,
      notInterestedLeads.length,
      followUpLeads.length,
      convertedLeadsThisMonth.length,
    ],
  );

  const tabBtn = (id: LeadMainTab, label: string) => {
    const c = tabCounts[id];
    const active = mainTab === id;
    
    // Define background colors for each tab number
    const getTabCountColor = () => {
      switch (id) {
        case "ongoing":
          return "bg-emerald-100 text-emerald-700 border-emerald-200";
        case "not_interested":
          return "bg-rose-100 text-rose-700 border-rose-200";
        case "followup":
          return "bg-amber-100 text-amber-700 border-amber-200";
        case "converted":
          return "bg-emerald-100 text-emerald-700 border-emerald-200";
        default:
          return "bg-slate-100 text-slate-700 border-slate-200";
      }
    };
    
    return (
      <button
        key={id}
        type="button"
        onClick={() => setMainTab(id)}
        className={cn(
          SX.leadTabBtn,
          active ? SX.leadTabActive : SX.leadTabIdle,
        )}
      >
        <span className="truncate">{label}</span>
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full border",
            getTabCountColor(),
          )}
        >
          {c}
        </span>
      </button>
    );
  };

  const filterInput =
    "mt-1.5 h-9 w-full rounded-none border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  const statItems: {
    key: string;
    label: string;
    sublabel?: string;
    value: number;
    accent: string;
  }[] = [
    {
      key: "ongoing",
      label: "Ongoing",
      value: counts.ongoing,
      accent: "text-primary",
    },
    {
      key: "ni",
      label: "Not interested",
      value: counts.notInterested,
      accent: "text-rose-600",
    },
    {
      key: "followup",
      label: "Follow-up",
      value: counts.followup,
      accent: "text-emerald-600",
    },
    {
      key: "conv",
      label: "Converted",
      sublabel: "Current month",
      value: counts.converted,
      accent: "text-indigo-600",
    },
  ];

  return (
    <div className={SX.leadPageRoot}>
      {loadError && (
        <div
          className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900"
          role="alert"
        >
          {loadError}{" "}
          <span className="text-slate-600">
            Check <code className="text-xs">MONGODB_URI</code> in{" "}
            <code className="text-xs">.env.local</code> and that MongoDB is
            reachable.
          </span>
        </div>
      )}
      {loading && (
        <p className="text-sm text-slate-500" aria-live="polite">
          Loading leads…
        </p>
      )}
      {actionNotice && (
        <p className="text-sm text-emerald-700" role="status">
          {actionNotice}
        </p>
      )}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Leads
          </h1>
          <span className="text-sm text-slate-500 font-normal">
            {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
          <button
            type="button"
            className={cn(
              SX.leadBtnGreen,
              "h-9 gap-1.5 px-3 text-[13px] font-semibold",
            )}
            onClick={() => setAddStudentOpen(true)}
          >
            <span className="text-lg leading-none" aria-hidden>
              +
            </span>
            Add student
          </button>
          <ImportExcelControl
            ref={importExcelRef}
            onImported={async () => {
              await refreshLeads({ force: true });
              setActionNotice("Leads imported.");
            }}
            showTriggerButton={false}
          />
          <LeadSheetActionsMenu
            onImport={() => importExcelRef.current?.open()}
            onExportCsv={() => setExportDialogOpen(true)}
          />
        </div>
      </header>

      <ExportLeadsDialog
        leads={leads}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />

      <div
        className="rounded-none border border-slate-200/80 bg-white px-3 py-3 shadow-sm sm:px-5 sm:py-3.5"
        aria-label="Lead counts"
      >
        <div className="flex flex-wrap gap-y-3 sm:gap-0 sm:divide-x sm:divide-slate-100">
          {statItems.map((c, i) => (
            <div
              key={c.key}
              className={cn(
                "flex min-w-[7.5rem] flex-1 flex-col gap-0.5 sm:px-5",
                i === 0 && "sm:pl-0",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {c.label}
              </span>
              {c.sublabel ? (
                <span className="text-[10px] font-medium normal-case tracking-normal text-slate-500">
                  {c.sublabel}
                </span>
              ) : null}
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums tracking-tight",
                  c.accent,
                )}
              >
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className={SX.leadWorkbook}>
        <div ref={toolbarRef} className={SX.leadToolbar}>
          <div className="relative">
            <button
              type="button"
              className={SX.leadToolbarIconBtn}
              aria-expanded={filterOpen}
              onClick={() => {
                setSortOpen(false);
                setFilterOpen((v) => !v);
              }}
              title="Filter"
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <div
                className={cn(
                  SX.leadPopover,
                  "w-[min(92vw,340px)] rounded-none border-slate-200 p-4 shadow-xl shadow-slate-900/15",
                )}
              >
                <div className="mb-3 border-b border-slate-100 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Filters
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Narrow the visible lead list
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-[12px]">
                    <span className="font-medium text-slate-600">
                      From date
                    </span>
                    <input
                      type="date"
                      className={filterInput}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="block text-[12px]">
                    <span className="font-medium text-slate-600">To date</span>
                    <input
                      type="date"
                      className={filterInput}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                </div>

                <label className="mt-3 block text-[12px]">
                  <span className="font-medium text-slate-600">
                    Target exam
                  </span>
                  <select
                    className={filterInput}
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                  >
                    <option value="">All</option>
                    {leadExamFilterOptions.map((c) => (
                      <option key={c} value={c}>
                        {targetExamLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-3 block text-[12px]">
                  <span className="font-medium text-slate-600">Status</span>
                  <select
                    className={filterInput}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="new">New</option>
                    <option value="interested">Interested</option>
                    <option value="not_interested">Not Interested</option>
                    <option value="followup_later">Follow-up Later</option>
                    <option value="called_no_response">
                      Called / No Response
                    </option>
                  </select>
                </label>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    className={cn(
                      SX.btnSecondary,
                      "h-9 w-full rounded-none border-slate-200 text-[13px]",
                    )}
                    onClick={() => {
                      setDateFrom("");
                      setDateTo("");
                      setFilterCourse("");
                      setFilterStatus("");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={SX.leadToolbarIconBtn}
              aria-expanded={sortOpen}
              onClick={() => {
                setFilterOpen(false);
                setSortOpen((v) => !v);
              }}
              title="Sort"
            >
              <SortIcon />
            </button>
            {sortOpen && (
              <div className={cn(SX.leadPopover, "w-[220px] p-2")}>
                {(
                  [
                    ["date", "Date"],
                    ["studentName", "Name"],
                    ["rowTone", "Status"],
                    ["targetExams", "Target (exams)"],
                    ["country", "Country"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="flex w-full justify-between rounded-none px-2 py-1.5 text-left text-[13px] hover:bg-[#f5f5f5]"
                    onClick={() => {
                      setSortKey(k);
                      setSortDir((d) =>
                        sortKey === k ? (d === "asc" ? "desc" : "asc") : "asc",
                      );
                    }}
                  >
                    {label}
                    {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="search"
            placeholder="Search name, phone, targets, country…"
            className={cn(SX.leadSearch, "ml-auto sm:max-w-[min(100%,360px)]")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            {sheetEditMode ? (
              <>
                <span className="text-[11px] text-slate-500">
                  {hasSheetDraft ? "Unsaved changes" : "Editing"}
                </span>
                <button
                  type="button"
                  className={cn(SX.btnSecondary, "h-9 px-3 text-[13px]")}
                  onClick={cancelSheetDraft}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={cn(SX.btnPrimary, "h-9 px-3 text-[13px]")}
                  disabled={!hasSheetDraft}
                  onClick={() => void saveSheetDraft()}
                >
                  Save changes
                </button>
              </>
            ) : (
              <button
                type="button"
                className={cn(
                  SX.leadBtnOutline,
                  "h-9 px-3 text-[13px] font-semibold",
                )}
                onClick={() => setSheetEditMode(true)}
              >
                Edit sheet
              </button>
            )}
          </div>
        </div>

        <div className={SX.leadTabBar}>
          {tabBtn("ongoing", "Ongoing")}
          {tabBtn("not_interested", "Not Interested")}
          {tabBtn("followup", "Follow-ups")}
          {tabBtn("converted", "Enrolled")}
        </div>

        <div className={SX.leadSheetBody}>
          {mainTab === "ongoing" && (
            <div className="space-y-8 px-3 py-4 md:px-4 md:py-5">
              <section aria-label="Today's leads">
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>Today&apos;s Leads</h2>
                </div>
                {newAndDailyLeads.length === 0 ? (
                  <div
                    className="mt-3 border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-600"
                    role="status"
                  >
                    No rows here yet.{" "}
                    <span className="font-medium">Add student</span> or import —
                    new leads appear in this block first.
                  </div>
                ) : (
                  <LeadSheetTable
                    variant="standard"
                    showFollowUpColumn
                    followUpDateOnlyWhenDue
                    showPipelineColumn={false}
                    pickDataTypeOnClick
                    leadSourceOptions={leadSources}
                    className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                    leads={applyDraftToList(newAndDailyLeads)}
                    sheetEditMode={sheetEditMode}
                    onDraftPatch={onDraftPatch}
                    onUpdateLead={onUpdateLead}
                    visibleIds={newAndDailyLeads.map((l) => l.id)}
                  />
                )}
              </section>

              <section aria-label="Interested ongoing pipeline">
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>Ongoing (interested)</h2>
                  <p className={SX.leadSectionMeta}>
                    Status <span className="font-medium">Interested</span> only
                    — other ongoing tones are not listed here.
                  </p>
                </div>
                {ongoingInterestedLeads.length === 0 ? (
                  <div
                    className="mt-3 border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-600"
                    role="status"
                  >
                    No interested leads here yet. From{" "}
                    <span className="font-medium">New &amp; Daily</span> above,
                    open the row <span className="font-medium">⋯</span> menu, choose{" "}
                    <span className="font-medium">Interested</span>, then pick a
                    course or exam — they appear here with{" "}
                    <span className="font-medium">Courses</span> filled in.
                  </div>
                ) : (
                  <LeadSheetTable
                    variant="standard"
                    showFollowUpColumn={false}
                    showPipelineColumn
                    pickDataTypeOnClick
                    leadSourceOptions={leadSources}
                    targetExamsColumnTitle="Courses"
                    formatTargetExamsDisplay={(exams) =>
                      exams?.length
                        ? exams.map((v) => targetExamLabel(v)).join(", ")
                        : "—"
                    }
                    actionMenuHideOptions={{ interested: true }}
                    className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                    leads={applyDraftToList(ongoingInterestedLeads)}
                    sheetEditMode={sheetEditMode}
                    onDraftPatch={onDraftPatch}
                    onUpdateLead={onUpdateLead}
                    visibleIds={ongoingInterestedLeads.map((l) => l.id)}
                  />
                )}
              </section>
            </div>
          )}

          {mainTab === "followup" && (
            <section
              className="px-3 py-4 md:px-4 md:py-5"
              aria-label="Follow-up leads"
            >
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Follow-ups</h2>
                <p className={SX.leadSectionMeta}>
                  {followUpLeads.length} lead
                  {followUpLeads.length === 1 ? "" : "s"} · call or message on
                  the date shown · Status = pipeline progress
                </p>
              </div>
              <LeadSheetTable
                showFollowUpColumn
                showPipelineColumn
                pickDataTypeOnClick
                leadSourceOptions={leadSources}
                actionMenuHideOptions={{ followUp: true }}
                className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                leads={applyDraftToList(followUpLeads)}
                sheetEditMode={sheetEditMode}
                onDraftPatch={onDraftPatch}
                onUpdateLead={onUpdateLead}
                visibleIds={followUpLeads.map((l) => l.id)}
              />
            </section>
          )}

          {mainTab === "not_interested" && (
            <section
              className="px-3 py-4 md:px-4 md:py-5"
              aria-label="Not interested leads"
            >
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Not interested</h2>
                <p className={SX.leadSectionMeta}>
                  {notInterestedLeads.length} closed lead
                  {notInterestedLeads.length === 1 ? "" : "s"} · archived from
                  active work · Status shows pipeline progress at close
                </p>
              </div>
              <LeadSheetTable
                showFollowUpColumn={false}
                showPipelineColumn
                showNotInterestedRemark
                interestedLabel="Mark as Interested"
                actionMenuHideOptions={{ notInterested: true }}
                className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                leads={applyDraftToList(notInterestedLeads)}
                sheetEditMode={sheetEditMode}
                onDraftPatch={onDraftPatch}
                onUpdateLead={onUpdateLead}
                visibleIds={notInterestedLeads.map((l) => l.id)}
              />
            </section>
          )}

          {mainTab === "converted" && (
            <section
              className="px-3 py-4 md:px-4 md:py-5"
              aria-label="Enrolled leads"
            >
              <div className={SX.leadSectionHead}>
                <div className="flex min-w-0 flex-wrap items-baseline gap-2 gap-y-1">
                  <h2 className={SX.leadSectionTitle}>Enrolled</h2>
                </div>
                <p className={SX.leadSectionMeta}>
                  {convertedLeadsFiltered.length} enrolled lead
                  {convertedLeadsFiltered.length === 1 ? "" : "s"} · filtered by month · Status shows completed pipeline steps
                </p>
              </div>

              {/* Month/year filter + name search */}
              <div className="mt-3 flex flex-wrap items-center gap-3 border-b border-slate-200/90 bg-white px-1 pb-3">
                <label className="flex items-center gap-1.5 text-[12px] text-slate-700">
                  <span className="font-medium">Month:</span>
                  <input
                    type="month"
                    className={cn(SX.input, "w-40 text-[12px]")}
                    value={convertedMonthFilter}
                    onChange={(e) => setConvertedMonthFilter(e.target.value)}
                  />
                </label>
                <input
                  type="search"
                  placeholder="Search name, phone, email…"
                  className={cn(SX.leadSearch, "max-w-[220px] text-[12px]")}
                  value={convertedNameSearch}
                  onChange={(e) => setConvertedNameSearch(e.target.value)}
                />
              </div>

              {/* Exam tiles (like /enroll-student page) */}
              {convertedLeadsFullPipeline.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  <div className="rounded-none border border-slate-200/90 bg-slate-50/50 px-3 py-2 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total enrolled</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-primary">
                      {convertedLeadsFullPipeline.length}
                    </p>
                  </div>
                  <div className="rounded-none border border-emerald-200/90 bg-emerald-50/50 px-3 py-2 text-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">This month</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-600">
                      {convertedLeadsThisMonth.length}
                    </p>
                  </div>
                </div>
              )}

              {convertedLeadsFiltered.length === 0 ? (
                <div
                  className="mt-3 border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-600"
                  role="status"
                >
                  No enrolled leads in the selected month. Try a different month or clear the name filter.
                </div>
              ) : (
                <LeadSheetTable
                  showFollowUpColumn={false}
                  showPipelineColumn
                  className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                  leads={applyDraftToList(convertedLeadsFiltered)}
                  sheetEditMode={sheetEditMode}
                  onDraftPatch={onDraftPatch}
                  onUpdateLead={onUpdateLead}
                  visibleIds={convertedLeadsFiltered.map((l) => l.id)}
                />
              )}
            </section>
          )}
        </div>
      </div>

      <AddStudentLeadDialog
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        onAdded={async () => {
          await refreshLeads({ force: true });
          setActionNotice("Lead added.");
        }}
        leadSourceOptions={leadSources}
      />

      <FollowUpDialog
        key={followUpId ?? "followup-dialog-closed"}
        open={followUpId !== null}
        onClose={() => setFollowUpId(null)}
        onSubmit={(data) => {
          if (followUpId) {
            const fu =
              data.date && data.date.length >= 8
                ? data.date
                : format(addDays(new Date(), 1), "yyyy-MM-dd");
            void onUpdateLead(followUpId, {
              rowTone: "followup_later",
              sheetTab: "followup",
              followUpDate: fu,
              pipelineMeta: {
                followUp: {
                  date: fu,
                  reminderTime: data.reminder || "07:00",
                  reason: data.reason,
                  notes: data.notes,
                },
              },
            });
          }
        }}
      />
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortIcon() {
  return (
    <span className="text-base leading-none text-[#212121]" aria-hidden>
      ⇅
    </span>
  );
}
