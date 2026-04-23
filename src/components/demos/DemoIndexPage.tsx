"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

type DemoStatus = "Scheduled" | "Cancelled" | "Completed";

type Demo = {
  leadId: string;
  studentName: string;
  email: string | null;
  phone: string;
  targetExams: string[];
  country: string;
  grade: string;
  meetRowId: string;
  subject: string;
  teacher: string;
  isoDate: string;
  timeHmIST: string;
  status: DemoStatus;
  studentTimeZone: string;
  meetLinkUrl: string;
  meetBookingId: string;
  meetWindowStartIso: string;
  meetWindowEndIso: string;
  examValue: string;
};

type DemoMainTab = "scheduled" | "cancelled" | "completed";

const DEMOS_CACHE_TTL_MS = 60_000;
let demosCache: { data: Demo[]; fetchedAt: number } | null = null;
let demosInFlight: Promise<Demo[]> | null = null;

function hasFreshDemosCache() {
  if (!demosCache) return false;
  return Date.now() - demosCache.fetchedAt < DEMOS_CACHE_TTL_MS;
}

function writeDemosCache(data: Demo[]) {
  demosCache = { data, fetchedAt: Date.now() };
}

async function fetchDemosFromApi(): Promise<Demo[]> {
  const res = await fetch("/api/demos", { cache: "no-store" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Failed to load demos",
    );
  }
  return (await res.json()) as Demo[];
}

async function getDemosCached(force = false): Promise<Demo[]> {
  if (!force && hasFreshDemosCache() && demosCache) {
    return demosCache.data;
  }
  if (!force && demosInFlight) return demosInFlight;

  demosInFlight = fetchDemosFromApi()
    .then((data) => {
      writeDemosCache(data);
      return data;
    })
    .finally(() => {
      demosInFlight = null;
    });
  return demosInFlight;
}

function sortDemos(list: Demo[], key: "date" | "studentName" | "teacher" | "subject", dir: "asc" | "desc"): Demo[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === "date") {
      cmp = a.isoDate.localeCompare(b.isoDate);
    } else if (key === "studentName") {
      cmp = a.studentName.localeCompare(b.studentName);
    } else if (key === "teacher") {
      cmp = a.teacher.localeCompare(b.teacher);
    } else if (key === "subject") {
      cmp = a.subject.localeCompare(b.subject);
    }
    return cmp * mul;
  });
}

export function DemoIndexPage() {
  const [demos, setDemos] = useState<Demo[]>(() => demosCache?.data ?? []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !demosCache);
  const [mainTab, setMainTab] = useState<DemoMainTab>("scheduled");
  const [sortKey, setSortKey] = useState<"date" | "studentName" | "teacher" | "subject">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const setDemosAndCache = useCallback((next: Demo[]) => {
    writeDemosCache(next);
    setDemos(next);
  }, []);

  const refreshDemos = useCallback(
    async (opts?: { force?: boolean; showLoading?: boolean }) => {
      const force = opts?.force ?? false;
      const showLoading = opts?.showLoading ?? false;
      if (showLoading) setLoading(true);
      try {
        const data = await getDemosCached(force);
        setDemosAndCache(data);
        setLoadError(null);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load demos from API.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [setDemosAndCache],
  );

  useEffect(() => {
    let cancelled = false;
    if (hasFreshDemosCache() && demosCache) {
      setDemosAndCache(demosCache.data);
      setLoading(false);
      setLoadError(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(!demosCache);
    setLoadError(null);
    refreshDemos({ force: true, showLoading: !demosCache })
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Could not load demos from API.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [refreshDemos, setDemosAndCache]);

  const filtered = useMemo(() => {
    let list = demos;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => {
        return (
          d.studentName.toLowerCase().includes(q) ||
          (d.email ?? "").toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          d.subject.toLowerCase().includes(q) ||
          d.teacher.toLowerCase().includes(q) ||
          d.targetExams.some((e) => e.toLowerCase().includes(q))
        );
      });
    }
    if (dateFrom) {
      list = list.filter((d) => d.isoDate >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((d) => d.isoDate <= dateTo);
    }
    return sortDemos(list, sortKey, sortDir);
  }, [demos, search, dateFrom, dateTo, sortKey, sortDir]);

  const scheduledDemos = useMemo(
    () => filtered.filter((d) => d.status === "Scheduled"),
    [filtered],
  );

  const cancelledDemos = useMemo(
    () => filtered.filter((d) => d.status === "Cancelled"),
    [filtered],
  );

  const completedDemos = useMemo(
    () => filtered.filter((d) => d.status === "Completed"),
    [filtered],
  );

  const currentDemos = useMemo(() => {
    switch (mainTab) {
      case "scheduled":
        return scheduledDemos;
      case "cancelled":
        return cancelledDemos;
      case "completed":
        return completedDemos;
    }
  }, [mainTab, scheduledDemos, cancelledDemos, completedDemos]);

  const formatDate = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), "d MMM yyyy");
    } catch {
      return isoDate;
    }
  };

  const formatTime = (timeHm: string) => {
    if (!timeHm) return "—";
    const [h, m] = timeHm.split(":").map(Number);
    const hour = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const targetExamLabel = (exam: string) => {
    return exam;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6 md:py-4">
        <h1 className="text-[18px] font-semibold tracking-tight text-slate-900">
          Demo Index
        </h1>
        <p className="mt-1 text-[13px] text-slate-600">
          View and manage all demo sessions across all students
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white">
        <div className="flex gap-0 px-4 md:px-6">
          {[
            { key: "scheduled" as const, label: "Schedule", count: scheduledDemos.length },
            { key: "cancelled" as const, label: "Cancel", count: cancelledDemos.length },
            { key: "completed" as const, label: "Conduct", count: completedDemos.length },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMainTab(tab.key)}
              className={cn(
                "relative border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
                mainTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "ml-2 rounded-full px-2 py-0.5 text-[11px]",
                  mainTab === tab.key
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by name, email, phone, subject, teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(SX.input, "h-9 w-[280px]")}
          />
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={cn(SX.btnSecondary, "h-9 px-3", filterOpen && "bg-slate-200")}
          >
            Filter
          </button>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as "date" | "studentName" | "teacher" | "subject")}
            className={cn(SX.select, "h-9")}
          >
            <option value="date">Sort by Date</option>
            <option value="studentName">Sort by Name</option>
            <option value="teacher">Sort by Teacher</option>
            <option value="subject">Sort by Subject</option>
          </select>
          <button
            type="button"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            className={cn(SX.btnSecondary, "h-9 px-3")}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </button>
          <button
            type="button"
            onClick={() => refreshDemos({ force: true, showLoading: true })}
            className={cn(SX.btnSecondary, "h-9 px-3")}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-medium text-slate-600 whitespace-nowrap">From date:</label>
              <input
                type="date"
                className={cn(SX.input, "h-9 w-40")}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-medium text-slate-600 whitespace-nowrap">To date:</label>
              <input
                type="date"
                className={cn(SX.input, "h-9 w-40")}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className={cn(SX.btnSecondary, "h-9 px-3")}
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 py-4 md:px-6 md:py-5">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-[13px] text-slate-600">
            Loading demos...
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">
            {loadError}
          </div>
        ) : currentDemos.length === 0 ? (
          <div
            className="mt-3 border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-600"
            role="status"
          >
            No demos found in this tab.
          </div>
        ) : (
          <div className="relative overflow-x-auto rounded-none shadow-sm border border-slate-200/90 bg-white [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent]">
            <table className="w-max min-w-full border-collapse text-[13px] antialiased" style={{ tableLayout: "fixed" }}>
              <thead className="text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 112 }}>Date</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 100 }}>IST Time</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 140 }}>Student Time</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 168 }}>Student Name</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 120 }}>Subject</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 120 }}>Teacher</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 140 }}>Exam</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 100 }}>Status</th>
                  <th className="sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm" style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentDemos.map((demo) => {
                  const rowBg = demo.status === "Scheduled"
                    ? "bg-sky-50/90"
                    : demo.status === "Completed"
                    ? "bg-emerald-50/90"
                    : demo.status === "Cancelled"
                    ? "bg-rose-50/90"
                    : "bg-white";
                  return (
                    <tr key={demo.meetRowId} className={cn("min-h-[42px] border-b border-slate-200/80 hover:brightness-[0.99]", rowBg)}>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">{formatDate(demo.isoDate)}</td>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">{formatTime(demo.timeHmIST)}</td>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">
                        <div>
                          <div className="font-medium text-slate-900">{formatTime(demo.timeHmIST)}</div>
                          <div className="text-[11px] text-slate-600">{demo.studentTimeZone}</div>
                        </div>
                      </td>
                      <td className="border border-slate-200/80 px-2 py-1.5">
                        <div>
                          <div className="font-medium text-slate-900">{demo.studentName}</div>
                          <div className="text-[11px] text-slate-600">{demo.phone}</div>
                        </div>
                      </td>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">{demo.subject}</td>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">{demo.teacher}</td>
                      <td className="border border-slate-200/80 px-2 py-1.5 text-slate-900">
                        {demo.targetExams.length > 0
                          ? demo.targetExams.map((e) => targetExamLabel(e)).join(", ")
                          : "—"}
                      </td>
                      <td className="border border-slate-200/80 px-2 py-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-[11px] font-medium",
                            demo.status === "Scheduled"
                              ? "bg-blue-50 text-blue-700"
                              : demo.status === "Completed"
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700",
                          )}
                        >
                          {demo.status}
                        </span>
                      </td>
                      <td className="border border-slate-200/80 px-2 py-1.5">
                        <a
                          href={`/students/${demo.leadId}`}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          View Student
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
