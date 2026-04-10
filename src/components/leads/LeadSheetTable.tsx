"use client";

import { addDays, format, parseISO } from "date-fns";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead } from "@/lib/types";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import { formatTargetExams } from "@/lib/lead-display";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";
import { formatLeadPhone } from "@/lib/phone-display";
import { rowToneBg, rowToneNameLinkClass } from "./row-styles";
import { PipelineDots } from "./PipelineDots";

type ColKey =
  | "date"
  | "studentName"
  | "parentName"
  | "dataType"
  | "grade"
  | "targetExams"
  | "country"
  | "phone";

type TextColKey =
  | "parentName"
  | "dataType"
  | "grade"
  | "country";

const ACTION_MENU_W = 180;

type ActionMenuState = { leadId: string; top: number; left: number } | null;

const EMPTY_SELECTED = new Set<string>();

/** Fixed column widths — horizontal scroll instead of drag-resize. */
const COL_WIDTHS: Record<string, number> = {
  idx: 52,
  date: 112,
  studentName: 168,
  parentName: 132,
  dataType: 92,
  grade: 72,
  targetExams: 140,
  country: 96,
  phone: 124,
  status: 112,
  followUp: 104,
  remark: 168,
  action: 52,
};

type EditTarget = { leadId: string; field: ColKey } | null;

type Props = {
  leads: Lead[];
  onUpdateLead: (id: string, patch: Partial<Lead>) => void;
  /** When true, cell edits are staged until parent saves. */
  sheetEditMode: boolean;
  onDraftPatch: (id: string, patch: Partial<Lead>) => void;
  visibleIds: string[];
  selectedIds?: Set<string>;
  onToggleRow?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean, visibleIds: string[]) => void;
  showRowSelect?: boolean;
  className?: string;
  variant?: "standard" | "daily";
  /** Hide follow-up date column (e.g. Ongoing pipeline — use Follow-ups tab for dates). */
  showFollowUpColumn?: boolean;
  /**
   * When true, shows the “Status” column (pipeline step dots). Default false — enable on
   * Interested, Follow-ups, Converted, and Not interested; keep “New & Daily” without it.
   */
  showPipelineColumn?: boolean;
  /** Show optional not-interested remark column (Not interested tab). */
  showNotInterestedRemark?: boolean;
};

export function LeadSheetTable({
  leads,
  onUpdateLead,
  sheetEditMode,
  onDraftPatch,
  selectedIds = EMPTY_SELECTED,
  onToggleRow = () => {},
  onSelectAll = () => {},
  visibleIds,
  showRowSelect = false,
  className,
  variant = "standard",
  showFollowUpColumn = true,
  showPipelineColumn = false,
  showNotInterestedRemark = false,
}: Props) {
  const baseId = useId();
  const [selectedCell, setSelectedCell] = useState<{
    leadId: string;
    field: ColKey;
  } | null>(null);
  const [editing, setEditing] = useState<EditTarget>(null);
  const activeEdit = sheetEditMode ? editing : null;
  const [actionMenu, setActionMenu] = useState<ActionMenuState>(null);
  const [notInterestedModalLead, setNotInterestedModalLead] =
    useState<Lead | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionMenu) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tableRef.current?.contains(t)) return;
      if (actionMenuRef.current?.contains(t)) return;
      setActionMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [actionMenu]);

  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenu]);

  useEffect(() => {
    if (!actionMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActionMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionMenu]);

  const allSelected =
    showRowSelect &&
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.has(id));

  const applyStatus = (lead: Lead, kind: "interested" | "followup") => {
    if (kind === "interested") {
      onUpdateLead(lead.id, {
        rowTone: "interested",
        sheetTab: "ongoing",
        followUpDate: null,
        notInterestedRemark: null,
      });
    } else {
      onUpdateLead(lead.id, {
        rowTone: "followup_later",
        sheetTab: "followup",
        followUpDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
        notInterestedRemark: null,
      });
    }
    setActionMenu(null);
  };

  const menuLead = useMemo(
    () => (actionMenu ? leads.find((l) => l.id === actionMenu.leadId) : undefined),
    [actionMenu, leads],
  );

  const isDaily = variant === "daily";

  const startEdit = (leadId: string, field: ColKey) => {
    if (!sheetEditMode) return;
    setEditing({ leadId, field });
  };

  return (
    <>
    <div
      className={cn(
        "relative overflow-x-auto rounded-lg shadow-sm",
        "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.5)_transparent]",
        isDaily
          ? "border border-amber-200/70 bg-gradient-to-b from-amber-50/40 via-white to-white"
          : "border border-slate-200/90 bg-white",
        className,
      )}
    >
      <table
        ref={tableRef}
        className="w-max min-w-full border-collapse text-[13px] antialiased"
        style={{ tableLayout: "fixed" }}
      >
        <thead className="text-[11px] font-semibold text-slate-600">
          <tr>
            <SheetTh w={COL_WIDTHS.idx} className="px-1 text-center">
              {showRowSelect ? (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked, visibleIds)}
                  aria-label="Select all"
                />
              ) : (
                <span className="font-normal text-slate-500">#</span>
              )}
            </SheetTh>
            <SheetTh w={COL_WIDTHS.date}>Date</SheetTh>
            <SheetTh w={COL_WIDTHS.studentName}>Student name</SheetTh>
            <SheetTh w={COL_WIDTHS.parentName}>Parent name</SheetTh>
            <SheetTh w={COL_WIDTHS.grade}>Grade</SheetTh>
            <SheetTh w={COL_WIDTHS.targetExams}>Target (exams)</SheetTh>
            <SheetTh w={COL_WIDTHS.country}>Country</SheetTh>
            <SheetTh w={COL_WIDTHS.phone}>Phone</SheetTh>
            {showPipelineColumn && (
              <SheetTh w={COL_WIDTHS.status}>Status</SheetTh>
            )}
            <SheetTh w={COL_WIDTHS.dataType}>Data type</SheetTh>
            {showFollowUpColumn && (
              <SheetTh w={COL_WIDTHS.followUp}>Follow-up</SheetTh>
            )}
            {showNotInterestedRemark && (
              <SheetTh w={COL_WIDTHS.remark}>Remark</SheetTh>
            )}
            <SheetTh w={COL_WIDTHS.action} className="px-1 text-center">
              Action
            </SheetTh>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, rowIndex) => {
            const tone = rowToneBg(lead.rowTone);
            return (
              <tr
                key={lead.id}
                className={cn(
                  "min-h-[42px] border-b border-slate-200/80 hover:brightness-[0.99]",
                  tone,
                )}
              >
                <td
                  style={{ width: COL_WIDTHS.idx }}
                  className={cn(
                    "border border-slate-200/80 px-1 py-1.5 text-center text-xs tabular-nums text-slate-600",
                    tone,
                  )}
                >
                  {showRowSelect ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={(e) => onToggleRow(lead.id, e.target.checked)}
                        aria-label={`Select ${lead.studentName}`}
                      />
                      <span>{rowIndex + 1}</span>
                    </div>
                  ) : (
                    <span>{rowIndex + 1}</span>
                  )}
                </td>
                <DataCell
                  width={COL_WIDTHS.date}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "date"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "date" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "date"
                  }
                  onEditStart={() => startEdit(lead.id, "date")}
                  sheetEditMode={sheetEditMode}
                >
                  {activeEdit?.leadId === lead.id &&
                  activeEdit.field === "date" ? (
                    <input
                      type="date"
                      className="w-full rounded-md border border-primary bg-white px-1 py-1 text-[13px]"
                      defaultValue={lead.date}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      onBlur={(e) => {
                        onDraftPatch(lead.id, { date: e.target.value });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() =>
                        setSelectedCell({ leadId: lead.id, field: "date" })
                      }
                      onDoubleClick={() => startEdit(lead.id, "date")}
                    >
                      {format(parseISO(lead.date), "dd/MM/yyyy")}
                    </button>
                  )}
                </DataCell>
                <td
                  style={{
                    width: COL_WIDTHS.studentName,
                    minWidth: COL_WIDTHS.studentName,
                  }}
                  className={cn(
                    "border border-slate-200/80 px-2 py-1.5",
                    selectedCell?.leadId === lead.id &&
                      selectedCell.field === "studentName" &&
                      !(
                        activeEdit?.leadId === lead.id &&
                        activeEdit.field === "studentName"
                      ) &&
                      "grid-cell-focus",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "studentName" })
                  }
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startEdit(lead.id, "studentName");
                  }}
                >
                  {activeEdit?.leadId === lead.id &&
                  activeEdit.field === "studentName" ? (
                    <input
                      className="w-full rounded-md border border-primary bg-white px-1 py-1 font-semibold"
                      defaultValue={lead.studentName}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      onBlur={(e) => {
                        onDraftPatch(lead.id, {
                          studentName: e.target.value,
                        });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <Link
                      href={`/students/${lead.id}`}
                      className={cn(
                        "font-semibold underline underline-offset-2",
                        rowToneNameLinkClass(lead.rowTone),
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.studentName}
                    </Link>
                  )}
                </td>
                <TextCell
                  lead={lead}
                  field="parentName"
                  width={COL_WIDTHS.parentName}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "parentName"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "parentName" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "parentName"
                  }
                  onEdit={() => startEdit(lead.id, "parentName")}
                  onDraftPatch={onDraftPatch}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                  sheetEditMode={sheetEditMode}
                />
                <TextCell
                  lead={lead}
                  field="grade"
                  width={COL_WIDTHS.grade}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "grade"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "grade" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "grade"
                  }
                  onEdit={() => startEdit(lead.id, "grade")}
                  onDraftPatch={onDraftPatch}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                  sheetEditMode={sheetEditMode}
                />
                <td
                  style={{ width: COL_WIDTHS.targetExams }}
                  className={cn(
                    "border border-slate-200/80 px-1 py-1.5",
                    selectedCell?.leadId === lead.id &&
                      selectedCell.field === "targetExams" &&
                      "grid-cell-focus",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "targetExams" })
                  }
                  onDoubleClick={() => startEdit(lead.id, "targetExams")}
                >
                  {activeEdit?.leadId === lead.id &&
                  activeEdit.field === "targetExams" ? (
                    <TargetExamsEditor
                      value={lead.targetExams}
                      onCommit={(exams) => {
                        onDraftPatch(lead.id, { targetExams: exams });
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <span
                      className="inline-flex w-full items-center justify-between gap-1 text-[12px] leading-snug"
                      title={formatTargetExams(lead.targetExams)}
                    >
                      <span className="min-w-0 break-words">
                        {formatTargetExams(lead.targetExams)}
                      </span>
                      {sheetEditMode && (
                        <ChevronDownGlyph
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          aria-hidden
                        />
                      )}
                    </span>
                  )}
                </td>
                <TextCell
                  lead={lead}
                  field="country"
                  width={COL_WIDTHS.country}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "country"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "country" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "country"
                  }
                  onEdit={() => startEdit(lead.id, "country")}
                  onDraftPatch={onDraftPatch}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                  sheetEditMode={sheetEditMode}
                />
                <td
                  style={{
                    width: COL_WIDTHS.phone,
                    minWidth: COL_WIDTHS.phone,
                  }}
                  className={cn(
                    "whitespace-nowrap border border-slate-200/80 px-2 py-1.5",
                    selectedCell?.leadId === lead.id &&
                      selectedCell.field === "phone" &&
                      !(
                        activeEdit?.leadId === lead.id &&
                        activeEdit.field === "phone"
                      ) &&
                      "grid-cell-focus",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "phone" })
                  }
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startEdit(lead.id, "phone");
                  }}
                >
                  {activeEdit?.leadId === lead.id &&
                  activeEdit.field === "phone" ? (
                    <input
                      className="w-full rounded-md border border-primary bg-white px-1 py-1 tabular-nums"
                      defaultValue={lead.phone}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      onBlur={(e) => {
                        onDraftPatch(lead.id, { phone: e.target.value });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="inline-block max-w-none whitespace-nowrap font-medium tabular-nums text-slate-900">
                      {formatLeadPhone(lead)}
                    </span>
                  )}
                </td>
                {showPipelineColumn && (
                  <td
                    style={{ width: COL_WIDTHS.status }}
                    className={cn(
                      "border border-slate-200/80 px-2 py-1.5",
                      tone,
                    )}
                  >
                    <PipelineDots completed={lead.pipelineSteps} />
                  </td>
                )}
                <TextCell
                  lead={lead}
                  field="dataType"
                  width={COL_WIDTHS.dataType}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "dataType"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "dataType" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "dataType"
                  }
                  onEdit={() => startEdit(lead.id, "dataType")}
                  onDraftPatch={onDraftPatch}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                  sheetEditMode={sheetEditMode}
                />
                {showFollowUpColumn && (
                  <td
                    style={{ width: COL_WIDTHS.followUp }}
                    className={cn(
                      "border border-slate-200/80 px-2 py-1.5 text-[12px]",
                      tone,
                    )}
                  >
                    {lead.followUpDate ? (
                      <span
                        className={cn(
                          lead.sheetTab === "followup" &&
                            "font-medium text-[#e65100]",
                        )}
                        title="Next follow-up date"
                      >
                        {format(parseISO(lead.followUpDate), "dd/MM/yyyy")}
                      </span>
                    ) : (
                      <span className="text-[#bdbdbd]">—</span>
                    )}
                  </td>
                )}
                {showNotInterestedRemark && (
                  <td
                    style={{ width: COL_WIDTHS.remark, maxWidth: COL_WIDTHS.remark }}
                    className={cn(
                      "border border-slate-200/80 px-2 py-1.5 align-top text-[12px] text-slate-700",
                      tone,
                    )}
                  >
                    {lead.notInterestedRemark?.trim() ? (
                      <span
                        className="line-clamp-4 whitespace-pre-wrap break-words"
                        title={lead.notInterestedRemark.trim()}
                      >
                        {lead.notInterestedRemark.trim()}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                )}
                <td
                  style={{ width: COL_WIDTHS.action }}
                  className={cn("border border-slate-200/80 px-0 py-1.5 text-center", tone)}
                >
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-lg leading-none text-slate-700 hover:bg-slate-100/90"
                    aria-expanded={actionMenu?.leadId === lead.id}
                    aria-haspopup="menu"
                    aria-controls={`${baseId}-menu-${lead.id}`}
                    onClick={(e) => {
                      const btn = e.currentTarget;
                      const rect = btn.getBoundingClientRect();
                      if (actionMenu?.leadId === lead.id) {
                        setActionMenu(null);
                        return;
                      }
                      const vw =
                        typeof window !== "undefined"
                          ? window.innerWidth
                          : rect.right;
                      const left = Math.min(
                        Math.max(8, rect.right - ACTION_MENU_W),
                        vw - ACTION_MENU_W - 8,
                      );
                      setActionMenu({
                        leadId: lead.id,
                        top: rect.bottom + 4,
                        left,
                      });
                    }}
                  >
                    ⋮
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {typeof document !== "undefined" &&
        actionMenu &&
        menuLead &&
        createPortal(
          <div
            ref={actionMenuRef}
            id={`${baseId}-menu-${actionMenu.leadId}`}
            role="menu"
            className="fixed z-[200] min-w-[180px] rounded-none border border-slate-200 bg-white py-1 text-left text-sm shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
            style={{
              top: actionMenu.top,
              left: actionMenu.left,
              width: ACTION_MENU_W,
            }}
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => applyStatus(menuLead, "interested")}
            >
              Interested
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => {
                setActionMenu(null);
                setNotInterestedModalLead(menuLead);
              }}
            >
              Not Interested
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => {
                setActionMenu(null);
                window.dispatchEvent(
                  new CustomEvent("lead-followup", {
                    detail: { id: menuLead.id },
                  }),
                );
              }}
            >
              Follow-up
            </button>
          </div>,
          document.body,
        )}
    </div>
    <NotInterestedRemarkDialog
      lead={notInterestedModalLead}
      onClose={() => setNotInterestedModalLead(null)}
      onConfirm={(remark) => {
        if (!notInterestedModalLead) return;
        const trimmed = remark.trim();
        onUpdateLead(notInterestedModalLead.id, {
          rowTone: "not_interested",
          sheetTab: "not_interested",
          followUpDate: null,
          notInterestedRemark: trimmed.length > 0 ? trimmed.slice(0, 2000) : null,
        });
        setNotInterestedModalLead(null);
      }}
    />
    </>
  );
}

function NotInterestedRemarkDialog({
  lead,
  onClose,
  onConfirm,
}: {
  lead: Lead | null;
  onClose: () => void;
  onConfirm: (remark: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [remark, setRemark] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (lead) {
      if (!d.open) d.showModal();
      setRemark(lead.notInterestedRemark?.trim() ?? "");
    } else if (d.open) {
      d.close();
    }
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    const dlg = ref.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("mousedown", onBackdrop);
    return () => dlg.removeEventListener("mousedown", onBackdrop);
  }, [lead, onClose]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-[210] w-[min(100vw-1.5rem,24rem)] max-h-[min(90vh,420px)] -translate-x-1/2 -translate-y-1/2",
        "overflow-hidden rounded-none border border-slate-200 bg-white p-0",
        "shadow-2xl shadow-black/20 backdrop:bg-black/40 backdrop:backdrop-blur-[2px]",
        "open:flex open:flex-col",
      )}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
      aria-labelledby="ni-remark-title"
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3">
        <h2
          id="ni-remark-title"
          className="text-[14px] font-bold tracking-tight text-slate-900"
        >
          Not interested
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          {lead ? (
            <>
              Mark{" "}
              <span className="font-medium text-slate-800">
                {lead.studentName}
              </span>{" "}
              as not interested. Add an optional remark below.
            </>
          ) : null}
        </p>
      </div>
      <div className="px-4 py-3">
        <label
          htmlFor="ni-remark-field"
          className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
        >
          Remark{" "}
          <span className="font-normal normal-case text-slate-400">(optional)</span>
        </label>
        <textarea
          id="ni-remark-field"
          rows={4}
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          maxLength={2000}
          placeholder="e.g. budget, location, enrolled elsewhere…"
          className="mt-1.5 w-full resize-y rounded-none border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25"
        />
        <p className="mt-1 text-[10px] text-slate-400">
          {remark.length}/2000
        </p>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={SX.btnPrimary}
          onClick={() => onConfirm(remark)}
        >
          Not Interested
        </button>
      </div>
    </dialog>
  );
}

function SheetTh({
  children,
  w,
  className,
}: {
  children: React.ReactNode;
  w: number;
  className?: string;
}) {
  return (
    <th
      style={{ width: w, minWidth: w }}
      className={cn(
        "sticky top-0 z-20 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </th>
  );
}

function DataCell({
  children,
  width,
  selected,
  onSelect,
  editing,
  onEditStart,
  sheetEditMode,
}: {
  children: React.ReactNode;
  width: number;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEditStart: () => void;
  sheetEditMode: boolean;
}) {
  return (
    <td
      style={{ width, minWidth: width }}
      className={cn(
        "border border-slate-200/80 px-1 py-1.5",
        selected && !editing && "grid-cell-focus",
      )}
      onClick={onSelect}
      onDoubleClick={() => sheetEditMode && onEditStart()}
    >
      {children}
    </td>
  );
}

function TextCell({
  lead,
  field,
  width,
  selected,
  onSelect,
  editing,
  onEdit,
  onDraftPatch,
  onCancelEdit,
  tone,
  sheetEditMode,
}: {
  lead: Lead;
  field: TextColKey;
  width: number;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEdit: () => void;
  onDraftPatch: (id: string, patch: Partial<Lead>) => void;
  onCancelEdit: () => void;
  tone: string;
  sheetEditMode: boolean;
}) {
  const val = lead[field];
  return (
    <td
      style={{ width, minWidth: width }}
      className={cn(
        "border border-slate-200/80 px-2 py-1.5",
        selected && !editing && "grid-cell-focus",
        tone,
      )}
      onClick={onSelect}
      onDoubleClick={() => sheetEditMode && onEdit()}
    >
      {editing ? (
        <input
          className="w-full rounded-md border border-primary bg-white px-1 py-1"
          defaultValue={val}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          onBlur={(e) => {
            onDraftPatch(lead.id, { [field]: e.target.value });
            onCancelEdit();
          }}
          autoFocus
        />
      ) : (
        val
      )}
    </td>
  );
}

function ChevronDownGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TargetExamsEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string[];
  onCommit: (exams: string[]) => void;
  onCancel: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(value));
  const toggle = (c: string) => {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  };
  return (
    <div className="flex flex-col gap-2 border border-primary bg-white p-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Select one or more
      </p>
      <div className="flex max-h-[140px] flex-wrap gap-x-3 gap-y-1.5 overflow-y-auto">
        {TARGET_EXAM_OPTIONS.map((c) => (
          <label
            key={c}
            className="flex cursor-pointer items-center gap-1.5 text-[12px] text-slate-800"
          >
            <input
              type="checkbox"
              className="rounded-none border-slate-300 text-primary"
              checked={sel.has(c)}
              onChange={() => toggle(c)}
            />
            {c}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
        <button
          type="button"
          className="rounded-none bg-success px-2 py-0.5 text-xs text-white"
          onClick={() => onCommit([...sel])}
        >
          OK
        </button>
        <button
          type="button"
          className="text-xs text-primary underline"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
