"use client";

import { useMemo, useState } from "react";
import { SX } from "@/components/student/student-excel-ui";
import { cn } from "@/lib/cn";
import { randomUuid } from "@/lib/randomUuid";
import {
  buildDefaultScheduleTemplateRows,
  normalizeScheduleTemplateEntries,
  type ScheduleDateRule,
  type ScheduleTemplateEntry,
  type ScheduleTemplateMilestoneRow,
  type ScheduleTemplateWeeklySessionRow,
} from "@/lib/scheduleTemplateTypes";
import { useScheduleTemplates } from "@/hooks/useScheduleTemplates";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";

function blankWeeklyRow(sortOrder: number): ScheduleTemplateWeeklySessionRow {
  return {
    id: randomUuid(),
    sessionLabel: `Session ${sortOrder}`,
    day: "",
    timeIST: "",
    subject: "",
    sessionDuration: "90 Minutes",
    sortOrder,
  };
}

function blankMilestone(sortOrder: number): ScheduleTemplateMilestoneRow {
  return {
    id: randomUuid(),
    milestone: "",
    description: "",
    dateRule: { kind: "offset_days", days: 0 },
    sortOrder,
  };
}

function blankTemplate(examValue: string): ScheduleTemplateEntry {
  const base = buildDefaultScheduleTemplateRows()[0];
  return {
    ...(base ?? {
      id: randomUuid(),
      examValue,
      programmeName: "New Programme",
      programmeDurationValue: 1,
      programmeDurationUnit: "years",
      targetExamLabel: examValue,
      weeklySessionStructure: [],
      milestones: [],
      guidelines: { generalGuidelines: [], mockTestsRevision: [] },
      isActive: true,
      sortOrder: 0,
    }),
    id: randomUuid(),
    examValue,
    programmeName: "New Programme",
    targetExamLabel: examValue,
  };
}

export default function ScheduleTemplatesPage() {
  const { templates, loading, error, reload } = useScheduleTemplates();
  const { activeValues: examValues, labelFor: examLabelFor } = useTargetExamOptions();

  const [draftTemplates, setDraftTemplates] = useState<ScheduleTemplateEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const data = useMemo(
    () => (draftTemplates.length > 0 ? draftTemplates : templates),
    [draftTemplates, templates],
  );

  const selected = useMemo(
    () => data.find((t) => t.id === selectedId) ?? data[0] ?? null,
    [data, selectedId],
  );

  const selectedIndex = useMemo(
    () => (selected ? data.findIndex((t) => t.id === selected.id) : -1),
    [data, selected],
  );

  const setTemplatesData = (next: ScheduleTemplateEntry[]) => {
    setDraftTemplates(next);
    if (!selectedId && next[0]) setSelectedId(next[0].id);
  };

  const updateSelected = (updater: (x: ScheduleTemplateEntry) => ScheduleTemplateEntry) => {
    if (!selected || selectedIndex < 0) return;
    const next = [...data];
    next[selectedIndex] = updater(selected);
    setTemplatesData(normalizeScheduleTemplateEntries(next));
  };

  const addTemplate = () => {
    const exam = examValues[0] ?? "JEE Main";
    const row = blankTemplate(exam);
    const next = normalizeScheduleTemplateEntries([...data, row]);
    setTemplatesData(next);
    setSelectedId(row.id);
    setMessage(null);
    setSaveError(null);
  };

  const removeTemplate = () => {
    if (!selected) return;
    if (!window.confirm("Remove this schedule template?")) return;
    const next = data.filter((t) => t.id !== selected.id);
    setTemplatesData(next);
    setSelectedId(next[0]?.id ?? "");
  };

  const saveAll = async () => {
    setSaving(true);
    setMessage(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings/schedule-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templates: data }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        templates?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setSaveError(payload.error || "Save failed.");
        return;
      }
      const normalized = normalizeScheduleTemplateEntries(payload.templates);
      setDraftTemplates(normalized);
      setSelectedId((prev) => prev || normalized[0]?.id || "");
      setMessage("Schedule templates saved.");
      await reload();
    } catch {
      setSaveError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const editRule = (row: ScheduleTemplateMilestoneRow, patch: Partial<ScheduleDateRule>) => {
    const r = row.dateRule;
    if (r.kind === "offset_days") {
      return { kind: "offset_days", days: Math.round((patch as { days?: number }).days ?? r.days) } as ScheduleDateRule;
    }
    if (r.kind === "month_year") {
      return {
        kind: "month_year",
        yearOffset: Math.round((patch as { yearOffset?: number }).yearOffset ?? r.yearOffset),
        month: Math.max(1, Math.min(12, Math.round((patch as { month?: number }).month ?? r.month))),
      } as ScheduleDateRule;
    }
    if (r.kind === "month_week") {
      return {
        kind: "month_week",
        yearOffset: Math.round((patch as { yearOffset?: number }).yearOffset ?? r.yearOffset),
        month: Math.max(1, Math.min(12, Math.round((patch as { month?: number }).month ?? r.month))),
        weekLabel: String((patch as { weekLabel?: string }).weekLabel ?? r.weekLabel),
      } as ScheduleDateRule;
    }
    return {
      kind: "exact_date",
      yearOffset: Math.round((patch as { yearOffset?: number }).yearOffset ?? r.yearOffset),
      month: Math.max(1, Math.min(12, Math.round((patch as { month?: number }).month ?? r.month))),
      day: Math.max(1, Math.min(31, Math.round((patch as { day?: number }).day ?? r.day))),
    } as ScheduleDateRule;
  };

  return (
    <div className={SX.pageWrap}>
      <div className={SX.outerSheet}>
        <div className={SX.toolbar}>
          <div className="min-w-0 flex-1">
            <h1 className={SX.toolbarTitle}>Schedule Templates</h1>
            <p className={SX.toolbarMeta}>
              Manage Programme Overview, Weekly Session Structure, Milestones, and
              Study Guidelines by exam + programme.
            </p>
          </div>
          <button type="button" className={SX.btnSecondary} onClick={addTemplate}>
            Add template
          </button>
          <button type="button" className={SX.btnSecondary} onClick={removeTemplate} disabled={!selected}>
            Remove template
          </button>
          <button type="button" className={SX.leadBtnGreen} disabled={saving} onClick={saveAll}>
            {saving ? "Saving..." : "Save templates"}
          </button>
        </div>

        <div
          className={cn(
            SX.leadStatBar,
            "border-t-0",
            (error || saveError) && "bg-rose-50/80 text-rose-900",
            !error && !saveError && message && "bg-emerald-50/60 text-emerald-900",
          )}
        >
          {loading
            ? "Loading..."
            : error || saveError || message || "Use one template per exam+programme. Student schedule auto-loads from these defaults."}
        </div>

        {!loading && (
          <div className="space-y-3 bg-white p-3">
            <section className="border border-slate-200 bg-slate-50/50 p-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Template
              </label>
              <select
                className={cn(SX.select, "mt-1 w-full max-w-xl")}
                value={selected?.id ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {examLabelFor(t.examValue)} — {t.programmeName}
                  </option>
                ))}
              </select>
            </section>

            {selected ? (
              <>
                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-800">
                    1. Programme Overview
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Exam</span>
                      <select
                        className={cn(SX.select, "mt-1 w-full")}
                        value={selected.examValue}
                        onChange={(e) =>
                          updateSelected((x) => ({ ...x, examValue: e.target.value }))
                        }
                      >
                        {examValues.map((v) => (
                          <option key={v} value={v}>
                            {examLabelFor(v)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Programme</span>
                      <input
                        className={cn(SX.input, "mt-1 w-full")}
                        value={selected.programmeName}
                        onChange={(e) => updateSelected((x) => ({ ...x, programmeName: e.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Target exam text</span>
                      <input
                        className={cn(SX.input, "mt-1 w-full")}
                        value={selected.targetExamLabel}
                        onChange={(e) => updateSelected((x) => ({ ...x, targetExamLabel: e.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Duration value</span>
                      <input
                        type="number"
                        className={cn(SX.input, "mt-1 w-full")}
                        value={selected.programmeDurationValue}
                        min={1}
                        onChange={(e) =>
                          updateSelected((x) => ({
                            ...x,
                            programmeDurationValue: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Duration unit</span>
                      <select
                        className={cn(SX.select, "mt-1 w-full")}
                        value={selected.programmeDurationUnit}
                        onChange={(e) =>
                          updateSelected((x) => ({
                            ...x,
                            programmeDurationUnit: e.target.value === "hours" ? "hours" : "years",
                          }))
                        }
                      >
                        <option value="years">Year(s)</option>
                        <option value="hours">Hour(s)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 self-end text-[13px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={selected.isActive !== false}
                        onChange={(e) => updateSelected((x) => ({ ...x, isActive: e.target.checked }))}
                      />
                      Active
                    </label>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-[12px] font-semibold text-slate-800">2. Weekly Session Structure</span>
                    <button
                      type="button"
                      className={SX.btnSecondary}
                      onClick={() =>
                        updateSelected((x) => ({
                          ...x,
                          weeklySessionStructure: [
                            ...x.weeklySessionStructure,
                            blankWeeklyRow(x.weeklySessionStructure.length + 1),
                          ],
                        }))
                      }
                    >
                      Add row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={cn(SX.dataTable, "min-w-[900px]")}>
                      <thead>
                        <tr>
                          <th className={SX.dataTh}>Session</th>
                          <th className={SX.dataTh}>Day</th>
                          <th className={SX.dataTh}>Time (IST)</th>
                          <th className={SX.dataTh}>Subject</th>
                          <th className={SX.dataTh}>Session Duration</th>
                          <th className={cn(SX.dataTh, "text-right")}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.weeklySessionStructure.map((r, i) => (
                          <tr key={r.id}>
                            <td className={SX.dataTd}>
                              <input
                                className={SX.input}
                                value={r.sessionLabel}
                                onChange={(e) =>
                                  updateSelected((x) => ({
                                    ...x,
                                    weeklySessionStructure: x.weeklySessionStructure.map((w) =>
                                      w.id === r.id ? { ...w, sessionLabel: e.target.value } : w,
                                    ),
                                  }))
                                }
                              />
                            </td>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.day} onChange={(e) => updateSelected((x) => ({ ...x, weeklySessionStructure: x.weeklySessionStructure.map((w) => (w.id === r.id ? { ...w, day: e.target.value } : w)) }))} />
                            </td>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.timeIST} onChange={(e) => updateSelected((x) => ({ ...x, weeklySessionStructure: x.weeklySessionStructure.map((w) => (w.id === r.id ? { ...w, timeIST: e.target.value } : w)) }))} />
                            </td>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.subject} onChange={(e) => updateSelected((x) => ({ ...x, weeklySessionStructure: x.weeklySessionStructure.map((w) => (w.id === r.id ? { ...w, subject: e.target.value } : w)) }))} />
                            </td>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.sessionDuration} onChange={(e) => updateSelected((x) => ({ ...x, weeklySessionStructure: x.weeklySessionStructure.map((w) => (w.id === r.id ? { ...w, sessionDuration: e.target.value } : w)) }))} />
                            </td>
                            <td className={cn(SX.dataTd, "text-right")}>
                              <button
                                type="button"
                                className={SX.btnGhost}
                                onClick={() =>
                                  updateSelected((x) => ({
                                    ...x,
                                    weeklySessionStructure: x.weeklySessionStructure.filter((w) => w.id !== r.id).map((w, idx) => ({ ...w, sortOrder: idx + 1 })),
                                  }))
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <span className="text-[12px] font-semibold text-slate-800">3. Key Milestones & Examination Timelines</span>
                    <button
                      type="button"
                      className={SX.btnSecondary}
                      onClick={() =>
                        updateSelected((x) => ({
                          ...x,
                          milestones: [...x.milestones, blankMilestone(x.milestones.length + 1)],
                        }))
                      }
                    >
                      Add row
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className={cn(SX.dataTable, "min-w-[1100px]")}>
                      <thead>
                        <tr>
                          <th className={SX.dataTh}>Milestone</th>
                          <th className={SX.dataTh}>Description</th>
                          <th className={SX.dataTh}>Rule</th>
                          <th className={SX.dataTh}>Year offset</th>
                          <th className={SX.dataTh}>Month</th>
                          <th className={SX.dataTh}>Day / Week</th>
                          <th className={cn(SX.dataTh, "text-right")}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.milestones.map((r) => (
                          <tr key={r.id}>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.milestone} onChange={(e) => updateSelected((x) => ({ ...x, milestones: x.milestones.map((m) => (m.id === r.id ? { ...m, milestone: e.target.value } : m)) }))} />
                            </td>
                            <td className={SX.dataTd}>
                              <input className={SX.input} value={r.description} onChange={(e) => updateSelected((x) => ({ ...x, milestones: x.milestones.map((m) => (m.id === r.id ? { ...m, description: e.target.value } : m)) }))} />
                            </td>
                            <td className={SX.dataTd}>
                              <select
                                className={SX.select}
                                value={r.dateRule.kind}
                                onChange={(e) =>
                                  updateSelected((x) => ({
                                    ...x,
                                    milestones: x.milestones.map((m) =>
                                      m.id === r.id
                                        ? {
                                            ...m,
                                            dateRule:
                                              e.target.value === "month_year"
                                                ? { kind: "month_year", yearOffset: 0, month: 1 }
                                                : e.target.value === "month_week"
                                                  ? { kind: "month_week", yearOffset: 0, month: 1, weekLabel: "Week 1" }
                                                  : e.target.value === "exact_date"
                                                    ? { kind: "exact_date", yearOffset: 0, month: 1, day: 1 }
                                                    : { kind: "offset_days", days: 0 },
                                          }
                                        : m,
                                    ),
                                  }))
                                }
                              >
                                <option value="offset_days">Offset days</option>
                                <option value="month_year">Month + year</option>
                                <option value="month_week">Month + week</option>
                                <option value="exact_date">Exact date</option>
                              </select>
                            </td>
                            <td className={SX.dataTd}>
                              {r.dateRule.kind === "offset_days" ? (
                                <span className="text-[12px] text-slate-500">—</span>
                              ) : (
                                <input
                                  type="number"
                                  className={SX.input}
                                  value={r.dateRule.yearOffset}
                                  onChange={(e) =>
                                    updateSelected((x) => ({
                                      ...x,
                                      milestones: x.milestones.map((m) =>
                                        m.id === r.id
                                          ? { ...m, dateRule: editRule(m, { yearOffset: Number(e.target.value) || 0 }) }
                                          : m,
                                      ),
                                    }))
                                  }
                                />
                              )}
                            </td>
                            <td className={SX.dataTd}>
                              {r.dateRule.kind === "offset_days" ? (
                                <span className="text-[12px] text-slate-500">—</span>
                              ) : (
                                <input
                                  type="number"
                                  min={1}
                                  max={12}
                                  className={SX.input}
                                  value={r.dateRule.month}
                                  onChange={(e) =>
                                    updateSelected((x) => ({
                                      ...x,
                                      milestones: x.milestones.map((m) =>
                                        m.id === r.id
                                          ? { ...m, dateRule: editRule(m, { month: Number(e.target.value) || 1 }) }
                                          : m,
                                      ),
                                    }))
                                  }
                                />
                              )}
                            </td>
                            <td className={SX.dataTd}>
                              {r.dateRule.kind === "offset_days" ? (
                                <input
                                  type="number"
                                  className={SX.input}
                                  value={r.dateRule.days}
                                  onChange={(e) =>
                                    updateSelected((x) => ({
                                      ...x,
                                      milestones: x.milestones.map((m) =>
                                        m.id === r.id
                                          ? { ...m, dateRule: editRule(m, { days: Number(e.target.value) || 0 }) }
                                          : m,
                                      ),
                                    }))
                                  }
                                />
                              ) : r.dateRule.kind === "month_week" ? (
                                <input
                                  className={SX.input}
                                  value={r.dateRule.weekLabel}
                                  onChange={(e) =>
                                    updateSelected((x) => ({
                                      ...x,
                                      milestones: x.milestones.map((m) =>
                                        m.id === r.id
                                          ? { ...m, dateRule: editRule(m, { weekLabel: e.target.value }) }
                                          : m,
                                      ),
                                    }))
                                  }
                                />
                              ) : r.dateRule.kind === "exact_date" ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={31}
                                  className={SX.input}
                                  value={r.dateRule.day}
                                  onChange={(e) =>
                                    updateSelected((x) => ({
                                      ...x,
                                      milestones: x.milestones.map((m) =>
                                        m.id === r.id
                                          ? { ...m, dateRule: editRule(m, { day: Number(e.target.value) || 1 }) }
                                          : m,
                                      ),
                                    }))
                                  }
                                />
                              ) : (
                                <span className="text-[12px] text-slate-500">—</span>
                              )}
                            </td>
                            <td className={cn(SX.dataTd, "text-right")}>
                              <button
                                type="button"
                                className={SX.btnGhost}
                                onClick={() =>
                                  updateSelected((x) => ({
                                    ...x,
                                    milestones: x.milestones.filter((m) => m.id !== r.id).map((m, idx) => ({ ...m, sortOrder: idx + 1 })),
                                  }))
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-800">
                    4. Study & Preparation Guidelines
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">General Guidelines (one per line)</span>
                      <textarea
                        className={cn(SX.textarea, "mt-1 min-h-[150px]")}
                        value={selected.guidelines.generalGuidelines.join("\n")}
                        onChange={(e) =>
                          updateSelected((x) => ({
                            ...x,
                            guidelines: {
                              ...x.guidelines,
                              generalGuidelines: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Mock Tests & Revision (one per line)</span>
                      <textarea
                        className={cn(SX.textarea, "mt-1 min-h-[150px]")}
                        value={selected.guidelines.mockTestsRevision.join("\n")}
                        onChange={(e) =>
                          updateSelected((x) => ({
                            ...x,
                            guidelines: {
                              ...x.guidelines,
                              mockTestsRevision: e.target.value.split("\n").map((line) => line.trim()).filter(Boolean),
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                </section>
              </>
            ) : (
              <p className="px-1 text-[13px] text-slate-600">No schedule template rows yet. Click Add template.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

