"use client";

import { addDays, format, isSameDay, parseISO } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, SortDir, SortKey } from "@/lib/types";
import { INITIAL_LEADS, TARGET_EXAM_OPTIONS } from "@/lib/mock-data";
import { AddStudentLeadDialog } from "./AddStudentLeadDialog";
import { ExportLeadsButton } from "./ExportLeadsButton";
import { FollowUpDialog } from "./FollowUpDialog";
import { ImportExcelControl } from "./ImportExcelControl";
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
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
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
  const [leadDraft, setLeadDraft] = useState<Record<string, Partial<Lead>>>(
    {},
  );
  const toolbarRef = useRef<HTMLDivElement>(null);

  const nextLeadNumericId = useMemo(() => {
    const nums = leads
      .map((l) => parseInt(l.id, 10))
      .filter((n) => !Number.isNaN(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }, [leads]);

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
      list = list.filter((l) => {
        const exams = l.targetExams.join(" ").toLowerCase();
        return (
          l.studentName.toLowerCase().includes(q) ||
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
      list = list.filter((l) => l.targetExams.includes(filterCourse));
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

  const onDraftPatch = useCallback((id: string, patch: Partial<Lead>) => {
    setLeadDraft((d) => ({
      ...d,
      [id]: { ...d[id], ...patch },
    }));
  }, []);

  const applyDraftToList = useCallback(
    (list: Lead[]) =>
      list.map((l) => ({ ...l, ...(leadDraft[l.id] ?? {}) })),
    [leadDraft],
  );

  const hasSheetDraft = useMemo(
    () =>
      Object.values(leadDraft).some((p) => p && Object.keys(p).length > 0),
    [leadDraft],
  );

  const saveSheetDraft = () => {
    for (const [id, patch] of Object.entries(leadDraft)) {
      if (patch && Object.keys(patch).length > 0) {
        onUpdateLead(id, patch);
      }
    }
    setLeadDraft({});
    setSheetEditMode(false);
  };

  const cancelSheetDraft = () => {
    setLeadDraft({});
    setSheetEditMode(false);
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
    "mt-1 w-full rounded-none border border-[#d0d0d0] px-2 py-1 text-[13px] shadow-[inset_0_1px_1px_rgba(0,0,0,0.04)]";

  const statItems = [
    {
      key: "ongoing",
      label: "Ongoing",
      value: counts.ongoing,
      accent: "text-primary",
    },
    {
      key: "followup",
      label: "Follow-up",
      value: counts.followup,
      accent: "text-emerald-600",
    },
    {
      key: "ni",
      label: "Not interested",
      value: counts.notInterested,
      accent: "text-rose-600",
    },
    {
      key: "conv",
      label: "Converted",
      value: counts.converted,
      accent: "text-indigo-600",
    },
  ] as const;

  return (
    <div className={SX.leadPageRoot}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
          Leads
        </h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <ExportLeadsButton leads={leads} />
          <ImportExcelControl
            nextStartId={nextLeadNumericId}
            onImport={(incoming) =>
              setLeads((prev) => [...incoming, ...prev])
            }
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
                  <span className="text-[#757575]">Target exam</span>
                  <select
                    className={filterInput}
                    value={filterCourse}
                    onChange={(e) => setFilterCourse(e.target.value)}
                  >
                    <option value="">All</option>
                    {TARGET_EXAM_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
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
                <button
                  type="button"
                  className="mt-1 text-[13px] font-medium text-[#1565c0] underline-offset-2 hover:underline"
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
                  onClick={saveSheetDraft}
                >
                  Save changes
                </button>
              </>
            ) : (
              <button
                type="button"
                className={cn(SX.leadBtnOutline, "h-9 px-3 text-[13px] font-semibold")}
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
          {tabBtn("converted", "Converted")}
        </div>

        <div className={SX.leadSheetBody}>
          {mainTab === "ongoing" && (
            <div className="space-y-8 px-3 py-4 md:px-4 md:py-5">
              <section aria-labelledby="daily-leads-heading">
                {todaysOngoingLeads.length === 0 ? (
                  <div
                    className="border border-slate-200 bg-slate-50 px-4 py-8 text-center"
                    role="status"
                  >
                    <h2
                      id="daily-leads-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Today
                    </h2>
                    <p className="mt-2 text-[13px] text-slate-600">
                      No data available for today&apos;s queue.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2
                          id="daily-leads-heading"
                          className="text-sm font-semibold text-slate-900"
                        >
                          Today&apos;s queue
                        </h2>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          New leads and follow-ups due ·{" "}
                          <time dateTime={format(today, "yyyy-MM-dd")}>
                            {format(today, "EEE, d MMM yyyy")}
                          </time>
                        </p>
                      </div>
                      <span className="rounded-none bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-100/80">
                        {todaysOngoingLeads.length}{" "}
                        {todaysOngoingLeads.length === 1 ? "row" : "rows"}
                      </span>
                    </div>
                    <LeadSheetTable
                      variant="daily"
                      className={cn(SX.leadGridFlush, "border-x-0")}
                      leads={applyDraftToList(todaysOngoingLeads)}
                      sheetEditMode={sheetEditMode}
                      onDraftPatch={onDraftPatch}
                      onUpdateLead={onUpdateLead}
                      visibleIds={todaysOngoingLeads.map((l) => l.id)}
                    />
                  </div>
                )}
              </section>

              <section
                className="space-y-3"
                aria-labelledby="pipeline-heading"
              >
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2
                      id="pipeline-heading"
                      className="text-sm font-semibold text-slate-900"
                    >
                      Rest of ongoing
                    </h2>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      Active leads not in today&apos;s queue ·{" "}
                      {ongoingLeadsRest.length}{" "}
                      {ongoingLeadsRest.length === 1 ? "row" : "rows"}
                    </p>
                  </div>
                  <span className="rounded-none bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-sky-100">
                    Pipeline
                  </span>
                </div>
                <LeadSheetTable
                  variant="standard"
                  className={cn(SX.leadGridFlush, "border-x-0")}
                  leads={applyDraftToList(ongoingLeadsRest)}
                  sheetEditMode={sheetEditMode}
                  onDraftPatch={onDraftPatch}
                  onUpdateLead={onUpdateLead}
                  visibleIds={ongoingLeadsRest.map((l) => l.id)}
                />
              </section>
            </div>
          )}

          {mainTab === "followup" && (
            <section className="px-3 py-4 md:px-4 md:py-5" aria-label="Follow-up leads">
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Follow-ups</h2>
                <p className={SX.leadSectionMeta}>
                  {followUpLeads.length} lead
                  {followUpLeads.length === 1 ? "" : "s"} · call or message on
                  the date shown
                </p>
              </div>
              <LeadSheetTable
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
                  active work
                </p>
              </div>
              <LeadSheetTable
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
              aria-label="Converted leads"
            >
              <div className={SX.leadSectionHead}>
                <h2 className={SX.leadSectionTitle}>Converted</h2>
                <p className={SX.leadSectionMeta}>
                  Students who finished onboarding ·{" "}
                  {convertedLeadsFullPipeline.length} lead
                  {convertedLeadsFullPipeline.length === 1 ? "" : "s"}
                </p>
              </div>
              <LeadSheetTable
                className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                leads={applyDraftToList(convertedLeadsFullPipeline)}
                sheetEditMode={sheetEditMode}
                onDraftPatch={onDraftPatch}
                onUpdateLead={onUpdateLead}
                visibleIds={convertedLeadsFullPipeline.map((l) => l.id)}
              />
            </section>
          )}
        </div>
      </div>

      <AddStudentLeadDialog
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        nextNumericId={nextLeadNumericId}
        onAdd={(lead) => setLeads((prev) => [lead, ...prev])}
      />

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
