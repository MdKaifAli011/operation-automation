"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import type { Lead, SortDir, SortKey } from "@/lib/types";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { AddAllLeadDialog } from "@/components/all-leads/AddAllLeadDialog";
import { ImportAllLeadExcelControl, type ImportAllLeadExcelControlHandle } from "@/components/all-leads/ImportAllLeadExcelControl";
import { ExportAllLeadsDialog } from "@/components/all-leads/ExportAllLeadsDialog";
import { AllLeadActionsMenu } from "@/components/all-leads/AllLeadActionsMenu";
import { useLeadSources } from "@/hooks/useLeadSources";
import { rowToneBg, rowToneNameLinkClass } from "@/components/leads/row-styles";
import { formatLeadPhone } from "@/lib/phone-display";

type AllLeadTab = "today" | "old";

const ALL_LEADS_CACHE_TTL_MS = 60_000;
let allLeadsCache: { data: Lead[]; fetchedAt: number } | null = null;
let allLeadsInFlight: Promise<Lead[]> | null = null;

function hasFreshAllLeadsCache() {
  if (!allLeadsCache) return false;
  return Date.now() - allLeadsCache.fetchedAt < ALL_LEADS_CACHE_TTL_MS;
}

function writeAllLeadsCache(data: Lead[]) {
  allLeadsCache = { data, fetchedAt: Date.now() };
}

async function fetchAllLeadsFromApi(params?: {
  dateFrom?: string;
  dateTo?: string;
  sortKey?: string;
  sortDir?: string;
  search?: string;
}): Promise<Lead[]> {
  const queryParams = new URLSearchParams();
  if (params?.dateFrom) queryParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) queryParams.set("dateTo", params.dateTo);
  if (params?.sortKey) queryParams.set("sortKey", params.sortKey);
  if (params?.sortDir) queryParams.set("sortDir", params.sortDir);
  if (params?.search) queryParams.set("search", params.search);
  
  const res = await fetch(`/api/all-leads?${queryParams.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load all leads",
    );
  }
  return (await res.json()) as Lead[];
}

async function getAllLeadsCached(force = false, params?: {
  dateFrom?: string;
  dateTo?: string;
  sortKey?: string;
  sortDir?: string;
  search?: string;
}): Promise<Lead[]> {
  if (!force && hasFreshAllLeadsCache() && allLeadsCache) {
    return allLeadsCache.data;
  }
  if (!force && allLeadsInFlight) return allLeadsInFlight;

  allLeadsInFlight = fetchAllLeadsFromApi(params)
    .then((data) => {
      writeAllLeadsCache(data);
      return data;
    })
    .finally(() => {
      allLeadsInFlight = null;
    });
  return allLeadsInFlight;
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

export default function AllLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(() => allLeadsCache?.data ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !allLeadsCache);
  const [mainTab, setMainTab] = useState<AllLeadTab>("today");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const importExcelRef = useRef<ImportAllLeadExcelControlHandle>(null);
  const leadSources = useLeadSources();

  const setLeadsAndCache = useCallback((next: Lead[]) => {
    writeAllLeadsCache(next);
    setLeads(next);
  }, []);

  const refreshLeads = useCallback(
    async (opts?: { force?: boolean; showLoading?: boolean }) => {
      const force = opts?.force ?? false;
      const showLoading = opts?.showLoading ?? false;
      if (showLoading) setLoading(true);
      try {
        const params = mainTab === "old" ? {
          dateFrom,
          dateTo,
          sortKey,
          sortDir,
          search,
        } : {
          sortKey,
          sortDir,
          search,
        };
        const data = await getAllLeadsCached(force, params);
        setLeadsAndCache(data);
        setLoadError(null);
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [setLeadsAndCache, mainTab, dateFrom, dateTo, sortKey, sortDir, search],
  );

  useEffect(() => {
    let cancelled = false;
    if (hasFreshAllLeadsCache() && allLeadsCache) {
      setLeadsAndCache(allLeadsCache.data);
      setLoading(false);
      setLoadError(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(!allLeadsCache);
    setLoadError(null);
    refreshLeads({ force: true, showLoading: !allLeadsCache })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Could not load all leads from API.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [refreshLeads, setLeadsAndCache]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(null), 2200);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    if (!filterOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  const today = new Date().toISOString().split("T")[0];
  
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
    
    if (mainTab === "today") {
      list = list.filter((l) => l.date === today);
    } else {
      // Old Lead tab - apply date range filter
      if (dateFrom) {
        list = list.filter((l) => l.date >= dateFrom);
      }
      if (dateTo) {
        list = list.filter((l) => l.date <= dateTo);
      }
    }
    
    return sortLeads(list, sortKey, sortDir);
  }, [leads, search, mainTab, dateFrom, dateTo, sortKey, sortDir, today]);

  const todayLeads = useMemo(
    () => filtered.filter((l) => l.date === today),
    [filtered, today],
  );

  const oldLeads = useMemo(
    () => filtered.filter((l) => l.date !== today),
    [filtered, today],
  );

  const tabCounts = useMemo(
    () => ({
      today: todayLeads.length,
      old: oldLeads.length,
    }),
    [todayLeads.length, oldLeads.length],
  );

  const tabBtn = (id: AllLeadTab, label: string) => {
    const c = tabCounts[id];
    const active = mainTab === id;
    
    const getTabCountColor = () => {
      switch (id) {
        case "today":
          return "bg-emerald-100 text-emerald-700 border-emerald-200";
        case "old":
          return "bg-slate-100 text-slate-700 border-slate-200";
        default:
          return "bg-slate-100 text-slate-700 border-slate-200";
      }
    };
    
    const getTabTextColor = () => {
      switch (id) {
        case "today":
          return active ? "text-emerald-700" : "text-emerald-600";
        case "old":
          return active ? "text-slate-700" : "text-slate-600";
        default:
          return "text-slate-700";
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
          getTabTextColor(),
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
    value: number;
    accent: string;
  }[] = [
    {
      key: "today",
      label: "Today's Leads",
      value: tabCounts.today,
      accent: "text-emerald-600",
    },
    {
      key: "old",
      label: "Old Leads",
      value: tabCounts.old,
      accent: "text-slate-600",
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
          Loading all leads…
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
            All Leads
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
          <ImportAllLeadExcelControl
            ref={importExcelRef}
            onImported={async () => {
              await refreshLeads({ force: true, showLoading: true });
            }}
            showTriggerButton={false}
          />
          <AllLeadActionsMenu
            onImport={() => importExcelRef.current?.open()}
            onExportCsv={() => setExportDialogOpen(true)}
          />
        </div>
      </header>

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
          <input
            type="search"
            placeholder="Search name, phone, targets, country…"
            className={cn(SX.leadSearch, "sm:max-w-[min(100%,280px)]")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <div className="relative">
              <button
                type="button"
                className={cn(
                  "h-9 px-3 text-[13px] font-medium transition-colors",
                  "border border-slate-200 bg-white text-slate-700 shadow-sm",
                  "hover:bg-slate-50 hover:border-slate-300",
                  "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                  (dateFrom || dateTo) && "border-primary bg-sky-50 text-primary",
                )}
                onClick={() => setFilterOpen(!filterOpen)}
                title="Filter by date range"
              >
                Filter
                <span className="ml-1.5 text-slate-400">▼</span>
              </button>

              {filterOpen && (
                <div className="absolute right-0 top-full z-10 mt-1 w-64 rounded-none border border-slate-200 bg-white shadow-lg">
                  <div className="p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Date Range
                    </p>
                    <label className="block text-[12px]">
                      <span className="font-medium text-slate-600">From</span>
                      <input
                        type="date"
                        className={filterInput}
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </label>
                    <label className="mt-2 block text-[12px]">
                      <span className="font-medium text-slate-600">To</span>
                      <input
                        type="date"
                        className={filterInput}
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </label>
                    {(dateFrom || dateTo) && (
                      <button
                        type="button"
                        className="mt-2 w-full text-[12px] font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                        }}
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sort Dropdown */}
            <select
              className={cn(
                "h-9 px-3 text-[13px] font-medium transition-colors",
                "border border-slate-200 bg-white text-slate-700 shadow-sm",
                "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                "cursor-pointer",
              )}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              title="Sort by date"
            >
              <option value="date">Newest first</option>
              <option value="studentName">Name (A-Z)</option>
              <option value="rowTone">Status</option>
              <option value="targetExams">Target (exams)</option>
              <option value="country">Country</option>
            </select>

            {/* Sort Direction Toggle */}
            <button
              type="button"
              className={cn(
                "h-9 w-9 flex items-center justify-center text-[13px] font-medium transition-colors",
                "border border-slate-200 bg-white text-slate-700 shadow-sm",
                "hover:bg-slate-50 hover:border-slate-300",
                "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
              )}
              onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
              title={sortDir === "desc" ? "Newest first" : "Oldest first"}
            >
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>

        <div className={SX.leadTabBar}>
          {tabBtn("today", "Today's")}
          {tabBtn("old", "Old Lead")}
        </div>

        <div className={SX.leadSheetBody}>
          {mainTab === "today" && (
            <div className="px-3 py-4 md:px-4 md:py-5">
              {todayLeads.length === 0 ? (
                <p className="text-sm text-slate-500">No leads for today.</p>
              ) : (
                <div className="relative overflow-x-auto rounded-none shadow-sm [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent] border border-slate-200/90 bg-white">
                  <table className="w-max min-w-full border-collapse text-[13px] antialiased" style={{ tableLayout: "fixed" }}>
                    <thead className="text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th style={{ width: 96, minWidth: 96 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Date</th>
                        <th style={{ width: 168, minWidth: 168 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Parent name</th>
                        <th style={{ width: 168, minWidth: 168 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Student name</th>
                        <th style={{ width: 124, minWidth: 124 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Phone</th>
                        <th style={{ width: 176, minWidth: 176 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Email</th>
                        <th style={{ width: 140, minWidth: 140 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Target Exams</th>
                        <th style={{ width: 96, minWidth: 96 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Country</th>
                        <th style={{ width: 112, minWidth: 112 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayLeads.map((lead) => {
                        const tone = rowToneBg(lead.rowTone);
                        return (
                          <tr
                            key={lead.id}
                            className={cn(
                              "min-h-[42px] border-b border-slate-200/80 hover:brightness-[0.99]",
                              tone,
                            )}
                          >
                            <td style={{ width: 96, minWidth: 96 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-xs tabular-nums text-slate-600", tone)}>
                              {format(parseISO(lead.date), "dd/MM/yyyy")}
                            </td>
                            <td style={{ width: 168, minWidth: 168 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.parentName || "—"}
                            </td>
                            <td style={{ width: 168, minWidth: 168 }} className={cn("border border-slate-200/80 px-2 py-1.5", tone)}>
                              <span className={cn("font-semibold", rowToneNameLinkClass(lead.rowTone))}>
                                {lead.studentName}
                              </span>
                            </td>
                            <td style={{ width: 124, minWidth: 124 }} className={cn("border border-slate-200/80 px-2 py-1.5 whitespace-nowrap", tone)}>
                              <span className="font-medium tabular-nums text-slate-900">
                                {formatLeadPhone(lead)}
                              </span>
                            </td>
                            <td style={{ width: 176, minWidth: 176 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.email || "—"}
                            </td>
                            <td style={{ width: 140, minWidth: 140 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.targetExams.join(", ")}
                            </td>
                            <td style={{ width: 96, minWidth: 96 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.country}
                            </td>
                            <td style={{ width: 112, minWidth: 112 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.rowTone}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {mainTab === "old" && (
            <div className="px-3 py-4 md:px-4 md:py-5">
              {oldLeads.length === 0 ? (
                <p className="text-sm text-slate-500">No old leads found.</p>
              ) : (
                <div className="relative overflow-x-auto rounded-none shadow-sm [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent] border border-slate-200/90 bg-white">
                  <table className="w-max min-w-full border-collapse text-[13px] antialiased" style={{ tableLayout: "fixed" }}>
                    <thead className="text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th style={{ width: 96, minWidth: 96 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Date</th>
                        <th style={{ width: 168, minWidth: 168 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Parent name</th>
                        <th style={{ width: 168, minWidth: 168 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Student name</th>
                        <th style={{ width: 124, minWidth: 124 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Phone</th>
                        <th style={{ width: 176, minWidth: 176 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Email</th>
                        <th style={{ width: 140, minWidth: 140 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Target Exams</th>
                        <th style={{ width: 96, minWidth: 96 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Country</th>
                        <th style={{ width: 112, minWidth: 112 }} className="sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oldLeads.map((lead) => {
                        const tone = rowToneBg(lead.rowTone);
                        return (
                          <tr
                            key={lead.id}
                            className={cn(
                              "min-h-[42px] border-b border-slate-200/80 hover:brightness-[0.99]",
                              tone,
                            )}
                          >
                            <td style={{ width: 96, minWidth: 96 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-xs tabular-nums text-slate-600", tone)}>
                              {format(parseISO(lead.date), "dd/MM/yyyy")}
                            </td>
                            <td style={{ width: 168, minWidth: 168 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.parentName || "—"}
                            </td>
                            <td style={{ width: 168, minWidth: 168 }} className={cn("border border-slate-200/80 px-2 py-1.5", tone)}>
                              <span className={cn("font-semibold", rowToneNameLinkClass(lead.rowTone))}>
                                {lead.studentName}
                              </span>
                            </td>
                            <td style={{ width: 124, minWidth: 124 }} className={cn("border border-slate-200/80 px-2 py-1.5 whitespace-nowrap", tone)}>
                              <span className="font-medium tabular-nums text-slate-900">
                                {formatLeadPhone(lead)}
                              </span>
                            </td>
                            <td style={{ width: 176, minWidth: 176 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.email || "—"}
                            </td>
                            <td style={{ width: 140, minWidth: 140 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.targetExams.join(", ")}
                            </td>
                            <td style={{ width: 96, minWidth: 96 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.country}
                            </td>
                            <td style={{ width: 112, minWidth: 112 }} className={cn("border border-slate-200/80 px-2 py-1.5 text-slate-600", tone)}>
                              {lead.rowTone}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AddAllLeadDialog
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        onAdded={async () => {
          await refreshLeads({ force: true, showLoading: true });
        }}
        leadSourceOptions={leadSources}
      />

      <ExportAllLeadsDialog
        leads={leads as unknown as Parameters<typeof ExportAllLeadsDialog>[0]["leads"]}
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
      />
    </div>
  );
}
