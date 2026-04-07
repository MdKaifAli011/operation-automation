"use client";

import { addDays, format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lead, SortDir, SortKey } from "@/lib/types";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import { AddStudentLeadDialog } from "./AddStudentLeadDialog";
import { LeadCsvTemplateButton } from "./LeadCsvTemplateButton";
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const refreshLeads = useCallback(async () => {
    const res = await fetch("/api/leads", { cache: "no-store" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        typeof err?.error === "string" ? err.error : "Failed to load leads",
      );
    }
    const data = (await res.json()) as Lead[];
    setLeads(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    refreshLeads()
      .catch((e) => {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : "Could not load leads from API.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshLeads]);

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

  /** All leads still on the ongoing sheet (interested + new imports + other statuses). */
  const ongoingSheetLeads = useMemo(
    () => filtered.filter((l) => l.sheetTab === "ongoing"),
    [filtered],
  );

  /** Ongoing tab · pipeline: only Interested (Demo → Brochure → …). */
  const ongoingInterestedLeads = useMemo(
    () => ongoingSheetLeads.filter((l) => l.rowTone === "interested"),
    [ongoingSheetLeads],
  );

  /** Ongoing tab · imports & intakes land here (status New, etc.) until marked Interested. */
  const ongoingOtherLeads = useMemo(
    () => ongoingSheetLeads.filter((l) => l.rowTone !== "interested"),
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

  const onUpdateLead = useCallback(
    async (id: string, patch: Partial<Lead>) => {
      setLeads((prev) =>
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
        setLeads((prev) => prev.map((l) => (l.id === id ? updated : l)));
      } catch {
        try {
          await refreshLeads();
        } catch {
          setLoadError("Could not sync with server.");
        }
      }
    },
    [refreshLeads],
  );

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

  const saveSheetDraft = async () => {
    for (const [id, patch] of Object.entries(leadDraft)) {
      if (patch && Object.keys(patch).length > 0) {
        await onUpdateLead(id, patch);
      }
    }
    setLeadDraft({});
    setSheetEditMode(false);
  };

  const cancelSheetDraft = () => {
    setLeadDraft({});
    setSheetEditMode(false);
  };

  const tabCounts = useMemo(
    () => ({
      ongoing: ongoingSheetLeads.length,
      not_interested: notInterestedLeads.length,
      followup: followUpLeads.length,
      converted: convertedLeadsFullPipeline.length,
    }),
    [
      ongoingSheetLeads.length,
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
    "mt-1.5 h-9 w-full rounded-none border border-slate-200 bg-white px-3 text-[13px] text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
      {loadError && (
        <div
          className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-900"
          role="alert"
        >
          {loadError}{" "}
          <span className="text-slate-600">
            Add <code className="text-xs">MONGODB_URI</code> to{" "}
            <code className="text-xs">.env.local</code> and run{" "}
            <code className="text-xs">npm run seed</code> to insert sample data.
          </span>
        </div>
      )}
      {loading && (
        <p className="text-sm text-slate-500" aria-live="polite">
          Loading leads…
        </p>
      )}
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
          <LeadCsvTemplateButton />
          <ImportExcelControl onImported={refreshLeads} />
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
                    <span className="font-medium text-slate-600">From date</span>
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
                  <span className="font-medium text-slate-600">Target exam</span>
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
                    <option value="called_no_response">Called / No Response</option>
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
              <section aria-label="New and Daily leads">
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>New &amp; Daily</h2>
                  <p className={SX.leadSectionMeta}>
                    {ongoingOtherLeads.length} lead
                    {ongoingOtherLeads.length === 1 ? "" : "s"} · intakes and
                    imports not yet in the Interested pipeline
                  </p>
                </div>
                {ongoingOtherLeads.length === 0 ? (
                  <div
                    className="mt-3 border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-600"
                    role="status"
                  >
                    No rows here yet. Imported leads with status{" "}
                    <span className="font-medium">New</span> show in this block.
                  </div>
                ) : (
                  <LeadSheetTable
                    variant="standard"
                    showFollowUpColumn={false}
                    showPipelineColumn={false}
                    className={cn(SX.leadGridFlush, "border-x-0", "mt-3")}
                    leads={applyDraftToList(ongoingOtherLeads)}
                    sheetEditMode={sheetEditMode}
                    onDraftPatch={onDraftPatch}
                    onUpdateLead={onUpdateLead}
                    visibleIds={ongoingOtherLeads.map((l) => l.id)}
                  />
                )}
              </section>

              <section aria-label="Interested ongoing pipeline">
                <div className={SX.leadSectionHead}>
                  <h2 className={SX.leadSectionTitle}>Ongoing (interested)</h2>
                  <p className={SX.leadSectionMeta}>
                    {ongoingInterestedLeads.length} lead
                    {ongoingInterestedLeads.length === 1 ? "" : "s"} · Demo →
                    Brochure → Fees → Schedule — use the Status column for step
                    progress
                  </p>
                </div>
                {ongoingInterestedLeads.length === 0 ? (
                  <div
                    className="mt-3 border border-slate-200 bg-slate-50 px-4 py-8 text-center text-[13px] text-slate-600"
                    role="status"
                  >
                    No interested leads here yet. Use the row{" "}
                    <span className="font-medium">⋯</span> menu and choose{" "}
                    <span className="font-medium">Interested</span> to move a lead into this
                    pipeline.
                  </div>
                ) : (
                  <LeadSheetTable
                    variant="standard"
                    showFollowUpColumn={false}
                    showPipelineColumn
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
            <section className="px-3 py-4 md:px-4 md:py-5" aria-label="Follow-up leads">
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
                  {convertedLeadsFullPipeline.length === 1 ? "" : "s"} · Status
                  shows completed pipeline steps
                </p>
              </div>
              <LeadSheetTable
                showFollowUpColumn={false}
                showPipelineColumn
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
        onAdded={refreshLeads}
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
