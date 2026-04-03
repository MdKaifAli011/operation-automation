"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead, SheetTabId, SortDir, SortKey } from "@/lib/types";
import { INITIAL_LEADS } from "@/lib/mock-data";
import { FollowUpDialog } from "./FollowUpDialog";
import { LeadSheetTable } from "./LeadSheetTable";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";

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
    } else if (key === "rowTone") {
      cmp = a.rowTone.localeCompare(b.rowTone);
    }
    return cmp * mul;
  });
}

export function LeadManagementPage() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [sheetTab, setSheetTab] = useState<SheetTabId>("ongoing");
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
          l.course.toLowerCase().includes(q),
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
        (l) => l.sheetTab === "converted" && l.pipelineSteps === 5,
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
      (l) => l.sheetTab === "converted" && l.pipelineSteps === 5,
    ).length;
    return { ongoing, followup, notInterested, converted };
  }, [leads]);

  const summary = useMemo(() => {
    return {
      ongoing: counts.ongoing,
      followup: counts.followup,
      notInterested: counts.notInterested,
    };
  }, [counts]);

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

  const tabBtn = (id: SheetTabId, label: string) => {
    const c =
      id === "ongoing"
        ? counts.ongoing
        : id === "followup"
          ? counts.followup
          : id === "not_interested"
            ? counts.notInterested
            : counts.converted;
    const active = sheetTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setSheetTab(id)}
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
            className={cn(SX.leadSelectSm, "w-[min(100%,200px)] shrink-0")}
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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={SX.leadBtnGreen}
              onClick={() => {
                const id = String(Date.now());
                setLeads((prev) => [
                  {
                    id,
                    date: format(today, "yyyy-MM-dd"),
                    followUpDate: null,
                    studentName: "New Student",
                    parentName: "",
                    counsellor: "Priya",
                    course: "NEET",
                    phone: "",
                    pipelineSteps: 0,
                    rowTone: "new",
                    sheetTab: "ongoing",
                  },
                  ...prev,
                ]);
              }}
            >
              + Add Student
            </button>
            <button type="button" className={SX.leadBtnOutline}>
              Save
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-[#757575]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
                Auto-save ON
              </span>
            </button>
          </div>
        </div>

        <div className={SX.leadStatBar}>
          <span className="font-semibold tabular-nums text-[#1565c0]">
            Ongoing {summary.ongoing}
          </span>
          <span className="h-3 w-px bg-[#d0d0d0]" aria-hidden />
          <span className="font-semibold tabular-nums text-[#e65100]">
            Follow-up {summary.followup}
          </span>
          <span className="h-3 w-px bg-[#d0d0d0]" aria-hidden />
          <span className="font-semibold tabular-nums text-[#c62828]">
            Not interested {summary.notInterested}
          </span>
        </div>

        <div className={SX.leadTabBar}>
          {tabBtn("ongoing", "Ongoing")}
          {tabBtn("followup", "Follow-up")}
          {tabBtn("not_interested", "Not Interested")}
          {tabBtn("converted", "Converted")}
        </div>

        <div className={SX.leadSheetBody}>
          {sheetTab === "ongoing" && (
            <>
              <div>
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>
                    Today&apos;s queue · {format(today, "dd MMM yyyy")}
                  </h2>
                  <p className={SX.leadSectionMeta}>
                    {todaysOngoingLeads.length} row
                    {todaysOngoingLeads.length === 1 ? "" : "s"} · new today +
                    follow-ups due
                  </p>
                </div>
                <LeadSheetTable
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
              </div>
              <div className="border-t border-[#d0d0d0]">
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>Ongoing pipeline</h2>
                  <p className={SX.leadSectionMeta}>
                    {ongoingLeadsRest.length} row
                    {ongoingLeadsRest.length === 1 ? "" : "s"} · not added today
                  </p>
                </div>
                <LeadSheetTable
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
              </div>
            </>
          )}

          {sheetTab === "followup" && (
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

          {sheetTab === "not_interested" && (
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

          {sheetTab === "converted" && (
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
