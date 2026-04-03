"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead, SheetTabId, SortDir, SortKey } from "@/lib/types";
import { INITIAL_LEADS } from "@/lib/mock-data";
import { FollowUpDialog } from "./FollowUpDialog";
import { LeadSheetTable } from "./LeadSheetTable";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

type LeadMainTab = "ongoing" | "not_interested" | "followup" | "converted";

function sortLeads(
  list: Lead[],
  key: SortKey,
  dir: SortDir,
): Lead[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if (key === "date") {
      cmp = a.date.localeCompare(b.date);
    } else if (key === "studentName") {
      cmp = a.studentName.localeCompare(b.studentName);
    } else if (key === "course") {
      cmp = a.course.localeCompare(b.course);
    } else if (key === "country") {
      cmp = a.country.localeCompare(b.country);
    } else if (key === "rowTone") {
      cmp = a.rowTone.localeCompare(b.rowTone);
    }
    return cmp * mul;
  });
}

export function LeadManagementPage() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [mainTab, setMainTab] = useState<LeadMainTab>("ongoing");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCounsellor, setFilterCounsellor] = useState("");
  const [followUpId, setFollowUpId] = useState<string | null>(null);

  useEffect(() => {
    const onFu = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>;
      setFollowUpId(ce.detail?.id ?? null);
    };
    window.addEventListener("lead-followup", onFu);
    return () => window.removeEventListener("lead-followup", onFu);
  }, []);

  const today = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    let list = leads;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.studentName.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.course.toLowerCase().includes(q) ||
          l.country.toLowerCase().includes(q),
      );
    }
    if (dateFrom) {
      list = list.filter((l) => l.date >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((l) => l.date <= dateTo);
    }
    if (filterCourse) {
      list = list.filter((l) => l.course === filterCourse);
    }
    if (filterStatus) {
      list = list.filter((l) => l.rowTone === filterStatus);
    }
    if (filterCounsellor) {
      list = list.filter((l) =>
        l.counsellor.toLowerCase().includes(filterCounsellor.toLowerCase()),
      );
    }
    return sortLeads(list, sortKey, sortDir);
  }, [
    leads,
    search,
    dateFrom,
    dateTo,
    filterCourse,
    filterStatus,
    filterCounsellor,
    sortKey,
    sortDir,
  ]);

  /** Ongoing tab · today’s area: new leads today (ongoing) OR follow-ups scheduled for today (still on follow-up sheet). */
  const todaysOngoingLeads = useMemo(() => {
    return filtered.filter((l) => {
      const isNewToday =
        l.sheetTab === "ongoing" && isSameDay(parseISO(l.date), today);
      const isFollowUpDueToday =
        l.sheetTab === "followup" &&
        l.followUpDate != null &&
        l.followUpDate !== "" &&
        isSameDay(parseISO(l.followUpDate), today);
      return isNewToday || isFollowUpDueToday;
    });
  }, [filtered, today]);

  /** Ongoing tab: rest of pipeline (ongoing, not today) — avoids duplicating today’s rows in both tables. */
  const ongoingLeadsRest = useMemo(
    () =>
      filtered.filter(
        (l) =>
          l.sheetTab === "ongoing" &&
          !isSameDay(parseISO(l.date), today),
      ),
    [filtered, today],
  );

  const followUpLeads = useMemo(
    () => filtered.filter((l) => l.sheetTab === "followup"),
    [filtered],
  );

  const notInterestedLeads = useMemo(
    () => filtered.filter((l) => l.sheetTab === "not_interested"),
    [filtered],
  );

  /** Converted tab: sheet + full pipeline (all status dots). */
  const convertedLeadsFullPipeline = useMemo(
    () =>
      filtered.filter(
        (l) => l.sheetTab === "converted" && l.pipelineSteps === 4,
      ),
    [filtered],
  );

  const counts = useMemo(() => {
    const ongoing = leads.filter((l) => l.sheetTab === "ongoing").length;
    const followup = leads.filter((l) => l.sheetTab === "followup").length;
    const notInterested = leads.filter(
      (l) => l.sheetTab === "not_interested",
    ).length;
    const converted = leads.filter(
      (l) => l.sheetTab === "converted" && l.pipelineSteps === 4,
    ).length;
    return { ongoing, followup, notInterested, converted };
  }, [leads]);

  const onUpdateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    );
  }, []);

  const onBulkStatus = (
    tone: Lead["rowTone"],
    tab: SheetTabId,
    extra?: Partial<Lead>,
  ) => {
    setLeads((prev) =>
      prev.map((l) =>
        selectedIds.has(l.id) ? { ...l, rowTone: tone, sheetTab: tab, ...extra } : l,
      ),
    );
    setSelectedIds(new Set());
  };

  const ongoingTabTotal =
    todaysOngoingLeads.length + ongoingLeadsRest.length;

  const tabCounts = useMemo(
    () => ({
      ongoing: ongoingTabTotal,
      not_interested: notInterestedLeads.length,
      followup: followUpLeads.length,
      converted: convertedLeadsFullPipeline.length,
    }),
    [
      ongoingTabTotal,
      notInterestedLeads.length,
      followUpLeads.length,
      convertedLeadsFullPipeline.length,
    ],
  );

  const tabBtn = (id: LeadMainTab, label: string) => {
    const c = tabCounts[id];
    const active = mainTab === id;
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
            SX.leadTabCount,
            active ? SX.leadTabCountActive : SX.leadTabCountIdle,
          )}
        >
          {c}
        </span>
      </button>
    );
  };

  const filterInput =
    "mt-1 w-full rounded-[2px] border border-[#d0d0d0] px-2 py-1 text-[13px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)]";

  return (
    <div className={SX.leadPageRoot}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            {
              key: "ongoing",
              label: "Ongoing",
              value: counts.ongoing,
              bar: "border-l-primary bg-white",
              accent: "text-primary",
            },
            {
              key: "followup",
              label: "Follow-up",
              value: counts.followup,
              bar: "border-l-emerald-500 bg-white",
              accent: "text-emerald-600",
            },
            {
              key: "ni",
              label: "Not interested",
              value: counts.notInterested,
              bar: "border-l-rose-500 bg-white",
              accent: "text-rose-600",
            },
            {
              key: "conv",
              label: "Converted",
              value: counts.converted,
              bar: "border-l-indigo-600 bg-white",
              accent: "text-indigo-700",
            },
          ] as const
        ).map((c) => (
          <div
            key={c.key}
            className={cn(
              "overflow-hidden rounded-xl border border-slate-200/90 shadow-sm ring-1 ring-slate-900/[0.03]",
              "border-l-4",
              c.bar,
            )}
          >
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {c.label}
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-bold tabular-nums tracking-tight",
                  c.accent,
                )}
              >
                {c.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={SX.leadWorkbook}>
        <div className={SX.leadToolbar}>
          <div className="relative">
            <button
              type="button"
              className={SX.leadToolbarIconBtn}
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((v) => !v)}
              title="Filter"
            >
              <FilterIcon />
            </button>
            {filterOpen && (
              <div className={SX.leadPopover}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#616161]">
                  Date range
                </p>
                <div className="mb-3 flex gap-2">
                  <label className="flex-1 text-[12px]">
                    <span className="text-[#757575]">From</span>
                    <input
                      type="date"
                      className={filterInput}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="flex-1 text-[12px]">
                    <span className="text-[#757575]">To</span>
                    <input
                      type="date"
                      className={filterInput}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                </div>
                <label className="mb-2 block text-[12px]">
                  <span className="text-[#757575]">Course</span>
                  <select
                    className={filterInput}
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="NEET">NEET</option>
                    <option value="JEE">JEE</option>
                    <option value="CUET">CUET</option>
                  </select>
                </label>
                <label className="mb-2 block text-[12px]">
                  <span className="text-[#757575]">Status</span>
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
                    <option value="called_no_response">Called / No Response</option>
                  </select>
                </label>
                <label className="mb-2 block text-[12px]">
                  <span className="text-[#757575]">Counsellor</span>
                  <input
                    className={filterInput}
                    value={filterCounsellor}
                    onChange={(e) => setFilterCounsellor(e.target.value)}
                    placeholder="Name"
                  />
                </label>
                <button
                  type="button"
                  className="mt-1 text-[13px] font-medium text-[#1565c0] underline-offset-2 hover:underline"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setFilterCourse("");
                    setFilterStatus("");
                    setFilterCounsellor("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={SX.leadToolbarIconBtn}
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((v) => !v)}
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
                    ["course", "Course"],
                    ["country", "Country"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="flex w-full justify-between rounded-[2px] px-2 py-1.5 text-left text-[13px] hover:bg-[#f5f5f5]"
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
            placeholder="Search student, phone, course…"
            className={SX.leadSearch}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            disabled={selectedIds.size === 0}
            className={cn(SX.leadSelectSm, "ml-auto w-[min(100%,200px)] shrink-0")}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (v === "interested")
                onBulkStatus("interested", "ongoing", { followUpDate: null });
              if (v === "not_interested")
                onBulkStatus("not_interested", "not_interested", {
                  followUpDate: null,
                });
              if (v === "followup")
                onBulkStatus("followup_later", "followup", {
                  followUpDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
                });
              e.target.selectedIndex = 0;
            }}
          >
            <option value="" disabled>
              Bulk status…
            </option>
            <option value="interested">Interested</option>
            <option value="not_interested">Not Interested</option>
            <option value="followup">Follow-up Later</option>
          </select>
        </div>

       
        <div className={SX.leadTabBar}>
          {tabBtn("ongoing", "Ongoing")}
          {tabBtn("not_interested", "Not Interested")}
          {tabBtn("followup", "Follow-ups")}
          {tabBtn("converted", "Converted")}
        </div>

        <div className={SX.leadSheetBody}>
          {mainTab === "ongoing" && (
            <div className="space-y-10 px-2 pb-4 pt-2 sm:px-4">
              <section aria-labelledby="daily-leads-heading">
                <div className="mb-4 flex flex-col gap-2 border-b border-amber-200/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <h2
                        id="daily-leads-heading"
                        className="text-base font-bold tracking-tight text-slate-900"
                      >
                        Daily &amp; today
                      </h2>
                      <span className="rounded-full bg-amber-100/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
                        {format(today, "dd MMM yyyy")}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-slate-500">
                      New intakes today and follow-ups due —{" "}
                      <span className="font-medium text-slate-700">
                        {todaysOngoingLeads.length}
                      </span>{" "}
                      {todaysOngoingLeads.length === 1 ? "row" : "rows"}
                    </p>
                  </div>
                </div>
                <LeadSheetTable
                  variant="daily"
                  className={cn(SX.leadGridFlush, "border-x-0")}
                  leads={todaysOngoingLeads}
                  onUpdateLead={onUpdateLead}
                  selectedIds={selectedIds}
                  onToggleRow={(id, checked) => {
                    setSelectedIds((prev) => {
                      const n = new Set(prev);
                      if (checked) n.add(id);
                      else n.delete(id);
                      return n;
                    });
                  }}
                  onSelectAll={(checked, ids) => {
                    if (checked) setSelectedIds(new Set(ids));
                    else setSelectedIds(new Set());
                  }}
                  visibleIds={todaysOngoingLeads.map((l) => l.id)}
                />
              </section>

              <section aria-labelledby="pipeline-heading">
                <div className="mb-4 flex flex-col gap-2 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <h2
                        id="pipeline-heading"
                        className="text-base font-bold tracking-tight text-slate-900"
                      >
                        Ongoing pipeline
                      </h2>
                      <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-sky-200/80">
                        Full sheet
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-slate-500">
                      Rest of active leads (not in today&apos;s queue) —{" "}
                      <span className="font-medium text-slate-700">
                        {ongoingLeadsRest.length}
                      </span>{" "}
                      {ongoingLeadsRest.length === 1 ? "row" : "rows"}
                    </p>
                  </div>
                </div>
                <LeadSheetTable
                  variant="standard"
                  className={cn(SX.leadGridFlush, "border-x-0")}
                  leads={ongoingLeadsRest}
                  onUpdateLead={onUpdateLead}
                  selectedIds={selectedIds}
                  onToggleRow={(id, checked) => {
                    setSelectedIds((prev) => {
                      const n = new Set(prev);
                      if (checked) n.add(id);
                      else n.delete(id);
                      return n;
                    });
                  }}
                  onSelectAll={(checked, ids) => {
                    if (checked) setSelectedIds(new Set(ids));
                    else setSelectedIds(new Set());
                  }}
                  visibleIds={ongoingLeadsRest.map((l) => l.id)}
                />
              </section>
            </div>
          )}

          {mainTab === "followup" && (
            <div>
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Follow-up</h2>
                <p className={SX.leadSectionMeta}>
                  {followUpLeads.length} lead
                  {followUpLeads.length === 1 ? "" : "s"}
                </p>
              </div>
              <LeadSheetTable
                className={cn(SX.leadGridFlush, "border-x-0")}
                leads={followUpLeads}
                onUpdateLead={onUpdateLead}
                selectedIds={selectedIds}
                onToggleRow={(id, checked) => {
                  setSelectedIds((prev) => {
                    const n = new Set(prev);
                    if (checked) n.add(id);
                    else n.delete(id);
                    return n;
                  });
                }}
                onSelectAll={(checked, ids) => {
                  if (checked) setSelectedIds(new Set(ids));
                  else setSelectedIds(new Set());
                }}
                visibleIds={followUpLeads.map((l) => l.id)}
              />
            </div>
          )}

          {mainTab === "not_interested" && (
            <div>
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Not interested</h2>
                <p className={SX.leadSectionMeta}>
                  {notInterestedLeads.length} lead
                  {notInterestedLeads.length === 1 ? "" : "s"}
                </p>
              </div>
              <LeadSheetTable
                className={cn(SX.leadGridFlush, "border-x-0")}
                leads={notInterestedLeads}
                onUpdateLead={onUpdateLead}
                selectedIds={selectedIds}
                onToggleRow={(id, checked) => {
                  setSelectedIds((prev) => {
                    const n = new Set(prev);
                    if (checked) n.add(id);
                    else n.delete(id);
                    return n;
                  });
                }}
                onSelectAll={(checked, ids) => {
                  if (checked) setSelectedIds(new Set(ids));
                  else setSelectedIds(new Set());
                }}
                visibleIds={notInterestedLeads.map((l) => l.id)}
              />
            </div>
          )}

          {mainTab === "converted" && (
            <div>
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Converted</h2>
                <p className={SX.leadSectionMeta}>
                  Full pipeline · {convertedLeadsFullPipeline.length} lead
                  {convertedLeadsFullPipeline.length === 1 ? "" : "s"}
                </p>
              </div>
              <LeadSheetTable
                className={cn(SX.leadGridFlush, "border-x-0")}
                leads={convertedLeadsFullPipeline}
                onUpdateLead={onUpdateLead}
                selectedIds={selectedIds}
                onToggleRow={(id, checked) => {
                  setSelectedIds((prev) => {
                    const n = new Set(prev);
                    if (checked) n.add(id);
                    else n.delete(id);
                    return n;
                  });
                }}
                onSelectAll={(checked, ids) => {
                  if (checked) setSelectedIds(new Set(ids));
                  else setSelectedIds(new Set());
                }}
                visibleIds={convertedLeadsFullPipeline.map((l) => l.id)}
              />
            </div>
          )}
        </div>
      </div>

      <FollowUpDialog
        open={followUpId !== null}
        onClose={() => setFollowUpId(null)}
        onSubmit={(data) => {
          if (followUpId) {
            const fu =
              data.date && data.date.length >= 8
                ? data.date
                : format(addDays(new Date(), 1), "yyyy-MM-dd");
            onUpdateLead(followUpId, {
              rowTone: "followup_later",
              sheetTab: "followup",
              followUpDate: fu,
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
