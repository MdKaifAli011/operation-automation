"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lead, SheetTabId, SortDir, SortKey } from "@/lib/types";
import { INITIAL_LEADS } from "@/lib/mock-data";
import { FollowUpDialog } from "./FollowUpDialog";
import { LeadSheetTable } from "./LeadSheetTable";
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

  const tabFiltered = useMemo(
    () => filtered.filter((l) => l.sheetTab === sheetTab),
    [filtered, sheetTab],
  );

  const todaysLeads = useMemo(() => {
    return filtered.filter((l) => isSameDay(parseISO(l.date), today));
  }, [filtered, today]);

  const counts = useMemo(() => {
    const ongoing = leads.filter((l) => l.sheetTab === "ongoing").length;
    const followup = leads.filter((l) => l.sheetTab === "followup").length;
    const notInterested = leads.filter(
      (l) => l.sheetTab === "not_interested",
    ).length;
    const converted = leads.filter((l) => l.sheetTab === "converted").length;
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

  const onBulkStatus = (tone: Lead["rowTone"], tab: SheetTabId) => {
    setLeads((prev) =>
      prev.map((l) =>
        selectedIds.has(l.id) ? { ...l, rowTone: tone, sheetTab: tab } : l,
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
    return (
      <button
        key={id}
        type="button"
        onClick={() => setSheetTab(id)}
        className={cn(
          "rounded-t-md border border-b-0 border-[#e0e0e0] px-4 py-2 text-sm font-medium transition-colors duration-150",
          sheetTab === id
            ? "border-b-2 border-b-[#1565c0] bg-white text-[#1565c0] shadow-none"
            : "bg-[#f8f9fa] text-[#757575]",
        )}
      >
        {label}{" "}
        <span
          className={cn(
            "ml-1 rounded-full px-2 py-0.5 text-xs",
            sheetTab === id
              ? "bg-[#e3f2fd] text-[#1565c0]"
              : "bg-[#eeeeee] text-[#757575]",
          )}
        >
          {c}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#e0e0e0] bg-white text-[#212121] hover:bg-[#f8f9fa]"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
            title="Filter"
          >
            <FilterIcon />
          </button>
          {filterOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[280px] rounded-[6px] border border-[#e0e0e0] bg-white p-4 shadow-none">
              <p className="mb-2 text-xs font-medium uppercase text-[#757575]">
                Date range
              </p>
              <div className="mb-3 flex gap-2">
                <label className="flex-1 text-xs">
                  <span className="text-[#757575]">From</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className="flex-1 text-xs">
                  <span className="text-[#757575]">To</span>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>
              <label className="mb-2 block text-xs">
                <span className="text-[#757575]">Course</span>
                <select
                  className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1"
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="NEET">NEET</option>
                  <option value="JEE">JEE</option>
                  <option value="CUET">CUET</option>
                </select>
              </label>
              <label className="mb-2 block text-xs">
                <span className="text-[#757575]">Status</span>
                <select
                  className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1"
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
              <label className="mb-2 block text-xs">
                <span className="text-[#757575]">Counsellor</span>
                <input
                  className="mt-1 w-full rounded-[6px] border border-[#e0e0e0] px-2 py-1"
                  value={filterCounsellor}
                  onChange={(e) => setFilterCounsellor(e.target.value)}
                  placeholder="Name"
                />
              </label>
              <button
                type="button"
                className="mt-2 text-sm text-[#1565c0] underline"
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
            className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#e0e0e0] bg-white hover:bg-[#f8f9fa]"
            aria-expanded={sortOpen}
            onClick={() => setSortOpen((v) => !v)}
            title="Sort"
          >
            <SortIcon />
          </button>
          {sortOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[220px] rounded-[6px] border border-[#e0e0e0] bg-white p-3 shadow-none">
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
                  className="flex w-full justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-[#f5f5f5]"
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
          placeholder="Search student, phone, course..."
          className="h-9 w-[min(100%,320px)] rounded-[6px] border border-[#e0e0e0] px-3 text-sm focus:outline focus:outline-2 focus:outline-[#1565c0]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          disabled={selectedIds.size === 0}
          className="h-9 rounded-[6px] border border-[#e0e0e0] bg-white px-2 text-sm disabled:opacity-50"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === "interested") onBulkStatus("interested", "ongoing");
            if (v === "not_interested")
              onBulkStatus("not_interested", "not_interested");
            if (v === "followup") onBulkStatus("followup_later", "followup");
            e.target.selectedIndex = 0;
          }}
        >
          <option value="" disabled>
            Bulk status change
          </option>
          <option value="interested">Interested</option>
          <option value="not_interested">Not Interested</option>
          <option value="followup">Follow-up Later</option>
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-[6px] bg-[#2e7d32] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#256628]"
            onClick={() => {
              const id = String(Date.now());
              setLeads((prev) => [
                {
                  id,
                  date: format(today, "yyyy-MM-dd"),
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
          <button
            type="button"
            className="flex items-center gap-2 rounded-[6px] border border-[#e0e0e0] bg-white px-4 py-2 text-sm font-medium text-[#212121] hover:bg-[#f8f9fa]"
          >
            Save
            <span className="inline-flex items-center gap-1 text-xs font-normal text-[#757575]">
              <span className="h-2 w-2 rounded-full bg-[#2e7d32]" />
              Auto-save ON
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-0 rounded-[6px] bg-[#f8f9fa] px-4 py-2 text-sm">
        <span className="font-bold text-[#1565c0]">
          Ongoing: {summary.ongoing}
        </span>
        <span className="mx-3 h-4 w-px bg-[#e0e0e0]" aria-hidden />
        <span className="font-bold text-[#f57f17]">
          Follow-up: {summary.followup}
        </span>
        <span className="mx-3 h-4 w-px bg-[#e0e0e0]" aria-hidden />
        <span className="font-bold text-[#c62828]">
          Not Interested: {summary.notInterested}
        </span>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#e0e0e0]">
        {tabBtn("ongoing", "Ongoing")}
        {tabBtn("followup", "Follow-up")}
        {tabBtn("not_interested", "Not Interested")}
        {tabBtn("converted", "Converted")}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-[#212121]">
          Today&apos;s Leads — {format(today, "dd MMMM yyyy")}
        </h2>
        <p className="text-sm text-[#757575]">
          {todaysLeads.length} new leads today
        </p>
        <LeadSheetTable
          leads={todaysLeads}
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
          visibleIds={todaysLeads.map((l) => l.id)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold text-[#212121]">Ongoing Leads</h2>
        <LeadSheetTable
          leads={tabFiltered}
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
          visibleIds={tabFiltered.map((l) => l.id)}
        />
      </section>

      <FollowUpDialog
        open={followUpId !== null}
        onClose={() => setFollowUpId(null)}
        onSubmit={() => {
          if (followUpId) {
            onUpdateLead(followUpId, {
              rowTone: "followup_later",
              sheetTab: "followup",
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
