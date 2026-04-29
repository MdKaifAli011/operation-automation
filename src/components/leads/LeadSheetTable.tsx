"use client";

import { endOfDay, format, isAfter, parseISO } from "date-fns";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lead } from "@/lib/types";
import { useTargetExamOptions } from "@/hooks/useTargetExamOptions";
import { formatTargetExams } from "@/lib/lead-display";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";
import { formatLeadPhone } from "@/lib/phone-display";
import { rowToneBg, rowToneBgWithFollowUp, rowToneNameLinkClass } from "./row-styles";
import { PipelineDots } from "./PipelineDots";
import { InterestedCourseDialog } from "./InterestedCourseDialog";
import { UploadedExcelModal, type UploadedFile } from "./UploadedExcelModal";
import {
  dataTypeToShortLabel,
  type LeadSourceOption,
} from "@/lib/leadSources";

function followUpDateIsDueOrPast(iso: string): boolean {
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return false;
    return !isAfter(d, endOfDay(new Date()));
  } catch {
    return false;
  }
}

type ColKey =
  | "date"
  | "studentName"
  | "parentName"
  | "dataType"
  | "instructions"
  | "grade"
  | "targetExams"
  | "country"
  | "phone"
  | "email";

type TextColKey =
  | "parentName"
  | "dataType"
  | "grade"
  | "country"
  | "email";

const ACTION_MENU_W = 180;
const DATA_TYPE_MENU_W = 216;

type ActionMenuState = { leadId: string; top: number; left: number } | null;

const EMPTY_SELECTED = new Set<string>();

/** Fixed column widths — horizontal scroll instead of drag-resize. */
const COL_WIDTHS: Record<string, number> = {
  idx: 52,
  date: 112,
  studentName: 168,
  parentName: 132,
  dataType: 92,
  instructions: 140,
  grade: 72,
  targetExams: 140,
  country: 96,
  phone: 124,
  email: 176,
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
   * When true with {@link showFollowUpColumn}, only show a date when it is due today or
   * overdue — future scheduled dates show "—" (those live on the Follow-ups tab).
   */
  followUpDateOnlyWhenDue?: boolean;
  /**
   * When true, shows the “Status” column (pipeline step dots). Default false — enable on
   * Interested, Follow-ups, Converted, and Not interested; keep “New & Daily” without it.
   */
  showPipelineColumn?: boolean;
  /** Show optional not-interested remark column (Not interested tab). */
  showNotInterestedRemark?: boolean;
  /** Show instructions column (Follow-up tab only). */
  showInstructionsColumn?: boolean;
  /**
   * Ongoing tab: click Data type cell to pick OL / WT / REF / PD (maps to stored channel).
   * Saves immediately; does not require sheet edit mode.
   */
  pickDataTypeOnClick?: boolean;
  /** Configured in Settings → Lead sources; drives OL/WT/… labels and stored values. */
  leadSourceOptions?: LeadSourceOption[];
  /** Overrides the target-exams column header (e.g. "Courses" on ongoing interested). */
  targetExamsColumnTitle?: string;
  /** Custom display for target exams cells (e.g. labels from Settings). */
  formatTargetExamsDisplay?: (exams: string[]) => string;
  /**
   * Hide ⋮ menu entries that would be redundant on the current sheet (e.g. no
   * “Interested” on Ongoing interested, no “Not interested” on that tab, no “Follow-up” on Follow-ups).
   */
  actionMenuHideOptions?: {
    interested?: boolean;
    notInterested?: boolean;
    followUp?: boolean;
    enrolled?: boolean;
  };
  /** Override the "Interested" menu label (e.g. "Mark as Interested" on the Not Interested tab). */
  interestedLabel?: string;
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
  followUpDateOnlyWhenDue = false,
  showPipelineColumn = false,
  showNotInterestedRemark = false,
  showInstructionsColumn = false,
  pickDataTypeOnClick = false,
  leadSourceOptions = [],
  targetExamsColumnTitle = "Target (exams)",
  formatTargetExamsDisplay,
  actionMenuHideOptions,
  interestedLabel = "Interested",
}: Props) {
  const baseId = useId();
  const [selectedCell, setSelectedCell] = useState<{
    leadId: string;
    field: ColKey;
  } | null>(null);
  const [editing, setEditing] = useState<EditTarget>(null);
  const activeEdit = sheetEditMode ? editing : null;
  const [actionMenu, setActionMenu] = useState<ActionMenuState>(null);
  const [dataTypeMenu, setDataTypeMenu] = useState<{
    leadId: string;
    top: number;
    left: number;
  } | null>(null);
  const [notInterestedModalLead, setNotInterestedModalLead] =
    useState<Lead | null>(null);
  const [interestedCourseLead, setInterestedCourseLead] =
    useState<Lead | null>(null);
  const [enrolledConfirmLead, setEnrolledConfirmLead] = useState<Lead | null>(null);
  const [uploadedExcelOpen, setUploadedExcelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const dataTypeMenuRef = useRef<HTMLDivElement>(null);

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
    if (!dataTypeMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (dataTypeMenuRef.current?.contains(e.target as Node)) return;
      setDataTypeMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [dataTypeMenu]);

  useEffect(() => {
    if (!dataTypeMenu) return;
    const close = () => setDataTypeMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [dataTypeMenu]);

  useEffect(() => {
    if (!dataTypeMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDataTypeMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dataTypeMenu]);

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

  const menuLead = useMemo(
    () => (actionMenu ? leads.find((l) => l.id === actionMenu.leadId) : undefined),
    [actionMenu, leads],
  );

  const hideInterested = actionMenuHideOptions?.interested === true;
  const hideNotInterested = actionMenuHideOptions?.notInterested === true;
  const hideFollowUp = actionMenuHideOptions?.followUp === true;
  const hideEnrolled = actionMenuHideOptions?.enrolled === true;

  const dataTypeMenuLead = useMemo(
    () =>
      dataTypeMenu
        ? leads.find((l) => l.id === dataTypeMenu.leadId)
        : undefined,
    [dataTypeMenu, leads],
  );

  const isDaily = variant === "daily";

  const sourcePickTitle = useMemo(
    () =>
      `Set source — ${leadSourceOptions.map((o) => `${o.abbrev} ${o.label}`).join(" · ")}`,
    [leadSourceOptions],
  );

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
            <SheetTh w={COL_WIDTHS.parentName}>Parent name</SheetTh>
            <SheetTh w={COL_WIDTHS.studentName}>Student name</SheetTh>
            <SheetTh w={COL_WIDTHS.grade}>Grade</SheetTh>
            <SheetTh w={COL_WIDTHS.targetExams}>{targetExamsColumnTitle}</SheetTh>
            <SheetTh w={COL_WIDTHS.country}>Country</SheetTh>
            <SheetTh w={COL_WIDTHS.phone}>Phone</SheetTh>
            <SheetTh w={COL_WIDTHS.email}>Email</SheetTh>
            {showPipelineColumn && (
              <SheetTh w={COL_WIDTHS.status}>Status</SheetTh>
            )}
            <SheetTh
              w={COL_WIDTHS.dataType}
              title={
                pickDataTypeOnClick
                  ? `Click to set source: ${leadSourceOptions.map((o) => `${o.abbrev} ${o.label}`).join(" · ")}`
                  : undefined
              }
            >
              Data type
            </SheetTh>
            {showInstructionsColumn && (
              <SheetTh w={COL_WIDTHS.instructions}>Instructions</SheetTh>
            )}
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
            const tone = variant === "standard" ? rowToneBgWithFollowUp(lead) : rowToneBg(lead.rowTone);
            const followUpRaw = lead.followUpDate?.trim();
            const showFollowUpCellDate = Boolean(
              followUpRaw &&
                (!followUpDateOnlyWhenDue ||
                  followUpDateIsDueOrPast(followUpRaw)),
            );
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
                    width: COL_WIDTHS.parentName,
                    minWidth: COL_WIDTHS.parentName,
                  }}
                  className={cn(
                    "border border-slate-200/80 px-2 py-1.5",
                    selectedCell?.leadId === lead.id &&
                      selectedCell.field === "parentName" &&
                      !(
                        activeEdit?.leadId === lead.id &&
                        activeEdit.field === "parentName"
                      ) &&
                      "grid-cell-focus",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "parentName" })
                  }
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    startEdit(lead.id, "parentName");
                  }}
                >
                  {activeEdit?.leadId === lead.id &&
                  activeEdit.field === "parentName" ? (
                    <input
                      className="w-full rounded-md border border-primary bg-white px-1 py-1"
                      defaultValue={lead.parentName}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditing(null);
                        }
                      }}
                      onBlur={(e) => {
                        onDraftPatch(lead.id, {
                          parentName: e.target.value,
                        });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <Link
                      href={`/students/${lead.id}`}
                      className={cn(
                        "underline underline-offset-2",
                        rowToneNameLinkClass(lead.rowTone),
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.parentName || "—"}
                    </Link>
                  )}
                </td>
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
                      title={
                        formatTargetExamsDisplay
                          ? formatTargetExamsDisplay(lead.targetExams ?? [])
                          : formatTargetExams(lead.targetExams)
                      }
                    >
                      <span className="min-w-0 break-words">
                        {formatTargetExamsDisplay
                          ? formatTargetExamsDisplay(lead.targetExams ?? [])
                          : formatTargetExams(lead.targetExams)}
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
                <TextCell
                  lead={lead}
                  field="email"
                  width={COL_WIDTHS.email}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "email"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "email" })
                  }
                  editing={
                    activeEdit?.leadId === lead.id &&
                    activeEdit.field === "email"
                  }
                  onEdit={() => startEdit(lead.id, "email")}
                  onDraftPatch={onDraftPatch}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                  sheetEditMode={sheetEditMode}
                />
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
                {pickDataTypeOnClick ? (
                  <DataTypePickCell
                    width={COL_WIDTHS.dataType}
                    selected={
                      selectedCell?.leadId === lead.id &&
                      selectedCell.field === "dataType"
                    }
                    onSelect={() =>
                      setSelectedCell({ leadId: lead.id, field: "dataType" })
                    }
                    tone={tone}
                    title={sourcePickTitle}
                    shortLabel={dataTypeToShortLabel(
                      lead.dataType,
                      leadSourceOptions,
                    )}
                    onOpenPicker={(rect) => {
                      setActionMenu(null);
                      const vw =
                        typeof window !== "undefined"
                          ? window.innerWidth
                          : rect.right;
                      const left = Math.min(
                        Math.max(8, rect.left),
                        vw - DATA_TYPE_MENU_W - 8,
                      );
                      setDataTypeMenu({
                        leadId: lead.id,
                        top: rect.bottom + 4,
                        left,
                      });
                    }}
                  />
                ) : (
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
                    leadSourceOptions={leadSourceOptions}
                  />
                )}
                {showInstructionsColumn && (
                  <InstructionsCell
                    lead={lead}
                    width={COL_WIDTHS.instructions}
                    tone={tone}
                  />
                )}
                {showFollowUpColumn && (
                  <td
                    style={{ width: COL_WIDTHS.followUp }}
                    className={cn(
                      "border border-slate-200/80 px-2 py-1.5 text-[12px]",
                      tone,
                    )}
                  >
                    {showFollowUpCellDate && followUpRaw ? (
                      <span
                        className={cn(
                          (lead.sheetTab === "followup" ||
                            followUpDateOnlyWhenDue) &&
                            "font-medium text-[#e65100]",
                        )}
                        title="Next follow-up date"
                      >
                        {format(parseISO(followUpRaw), "dd/MM/yyyy")}
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
                      setDataTypeMenu(null);
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
        dataTypeMenu &&
        dataTypeMenuLead &&
        createPortal(
          <div
            ref={dataTypeMenuRef}
            role="menu"
            aria-label="Set data type"
            className="fixed z-[201] rounded-none border border-slate-200 bg-white py-0.5 text-left text-[13px] shadow-lg shadow-slate-900/10"
            style={{
              top: dataTypeMenu.top,
              left: dataTypeMenu.left,
              width: DATA_TYPE_MENU_W,
            }}
          >
            <p className="border-b border-slate-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Lead source
            </p>
            {leadSourceOptions.map(({ abbrev, value, label }) => (
              <button
                key={`${abbrev}-${value}`}
                type="button"
                role="menuitem"
                className={cn(
                  "flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-slate-50",
                  dataTypeMenuLead.dataType === value &&
                    "bg-primary/[0.06] font-medium text-slate-900",
                )}
                onClick={() => {
                  onUpdateLead(dataTypeMenuLead.id, { dataType: value });
                  setDataTypeMenu(null);
                }}
              >
                <span className="w-8 shrink-0 text-center font-mono text-[11px] font-bold tabular-nums text-slate-800">
                  {abbrev}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] leading-snug text-slate-600">
                  {label}
                </span>
              </button>
            ))}
          </div>,
          document.body,
        )}
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
            {!hideInterested ? (
              <button
                type="button"
                role="menuitem"
                className={cn(
                  "block w-full px-3 py-2 text-left transition-colors",
                  interestedLabel === "Mark as Interested"
                    ? "font-medium text-emerald-700 hover:bg-emerald-50"
                    : "text-slate-700 hover:bg-slate-50",
                )}
                onClick={() => {
                  setInterestedCourseLead(menuLead);
                  setActionMenu(null);
                }}
              >
                {interestedLabel}
              </button>
            ) : null}
            {!hideNotInterested ? (
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
            ) : null}
            {!hideFollowUp ? (
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
            ) : null}
            {!hideEnrolled ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                onClick={() => {
                  setActionMenu(null);
                  setEnrolledConfirmLead(menuLead);
                }}
              >
                Enrolled
              </button>
            ) : null}
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50"
              onClick={() => {
                setActionMenu(null);
                setUploadedExcelOpen(true);
              }}
            >
              Lead From Platform
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
    <InterestedCourseDialog
      lead={interestedCourseLead}
      onClose={() => setInterestedCourseLead(null)}
      onConfirm={(exams) => {
        if (!interestedCourseLead) return;
        const id = interestedCourseLead.id;
        setInterestedCourseLead(null);
        onUpdateLead(id, {
          rowTone: "interested",
          sheetTab: "ongoing",
          followUpDate: null,
          notInterestedRemark: null,
          targetExams: exams,
        });
      }}
    />
    <EnrolledConfirmDialog
      lead={enrolledConfirmLead}
      onClose={() => setEnrolledConfirmLead(null)}
      onConfirm={() => {
        if (!enrolledConfirmLead) return;
        onUpdateLead(enrolledConfirmLead.id, {
          sheetTab: "converted",
          followUpDate: null,
        });
        setEnrolledConfirmLead(null);
      }}
    />
    <UploadedExcelModal
      open={uploadedExcelOpen}
      onClose={() => setUploadedExcelOpen(false)}
      onSelectFile={(file) => {
        setSelectedFile(file);
        // Trigger import logic - could open ImportExcelControl with the selected file
        window.dispatchEvent(
          new CustomEvent("import-excel-file", {
            detail: { fileUrl: file.fileUrl, fileName: file.originalName || file.fileName },
          }),
        );
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

function DataTypePickCell({
  width,
  selected,
  onSelect,
  tone,
  title,
  shortLabel,
  onOpenPicker,
}: {
  width: number;
  selected: boolean;
  onSelect: () => void;
  tone: string;
  title: string;
  shortLabel: string;
  onOpenPicker: (rect: DOMRect) => void;
}) {
  return (
    <td
      style={{ width, minWidth: width }}
      className={cn(
        "border border-slate-200/80 px-1 py-1.5",
        selected && "grid-cell-focus",
        tone,
      )}
    >
      <button
        type="button"
        className={cn(
          "w-full rounded border border-transparent px-1 py-0.5 text-left text-[12px] font-semibold tabular-nums tracking-tight",
          "text-slate-800 transition-colors hover:border-slate-300 hover:bg-white/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        )}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
          onOpenPicker(e.currentTarget.getBoundingClientRect());
        }}
      >
        {shortLabel}
      </button>
    </td>
  );
}

function SheetTh({
  children,
  w,
  className,
  title,
}: {
  children: React.ReactNode;
  w: number;
  className?: string;
  title?: string;
}) {
  return (
    <th
      style={{ width: w, minWidth: w }}
      title={title}
      className={cn(
        "sticky top-0 z-10 border border-slate-200/90 bg-slate-50/98 px-2 py-2.5 text-left backdrop-blur-sm",
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
  leadSourceOptions,
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
  leadSourceOptions?: LeadSourceOption[];
}) {
  const val = lead[field];
  const strVal = val == null ? "" : String(val);
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
          type={field === "email" ? "email" : "text"}
          className="w-full rounded-md border border-primary bg-white px-1 py-1"
          defaultValue={strVal}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          onBlur={(e) => {
            const next =
              field === "email" ? e.target.value.trim() : e.target.value;
            onDraftPatch(lead.id, { [field]: next });
            onCancelEdit();
          }}
          autoFocus
        />
      ) : field === "email" ? (
        <span
          className={cn(
            "block truncate text-[12px]",
            !strVal.trim() && "text-slate-400",
          )}
          title={strVal.trim() || undefined}
        >
          {strVal.trim() || "—"}
        </span>
      ) : field === "dataType" ? (
        <span
          className={cn(
            "block truncate text-[12px]",
            !strVal.trim() && "text-slate-400",
          )}
          title={strVal.trim() || undefined}
        >
          {dataTypeToShortLabel(strVal, leadSourceOptions) || "OL"}
        </span>
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
  const { activeValues, labelFor } = useTargetExamOptions();
  const choiceSet = useMemo(() => {
    const s = new Set<string>(activeValues);
    for (const x of value) if (x) s.add(x);
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [activeValues, value]);
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
        {choiceSet.map((c) => (
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
            {labelFor(c)}
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

function EnrolledConfirmDialog({
  lead,
  onClose,
  onConfirm,
}: {
  lead: Lead | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (lead) {
      if (!d.open) d.showModal();
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
      aria-labelledby="enrolled-confirm-title"
    >
      <div className="border-b border-slate-100 bg-slate-50/90 px-4 py-3">
        <h2
          id="enrolled-confirm-title"
          className="text-[14px] font-bold tracking-tight text-slate-900"
        >
          Confirm Enrollment
        </h2>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          {lead ? (
            <>
              Mark{" "}
              <span className="font-medium text-slate-800">
                {lead.studentName}
              </span>{" "}
              as enrolled. This will move the student to the{" "}
              <span className="font-medium">Enrolled</span> section.
            </>
          ) : null}
        </p>
      </div>
      <div className="px-4 py-4">
        <div className="rounded-md bg-emerald-50 p-3 text-[13px] text-emerald-800">
          <p className="font-medium">Are you sure?</p>
          <p className="mt-1 text-[12px] text-emerald-700">
            The student will be moved from Ongoing to the Enrolled tab.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
        <button type="button" className={SX.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={cn(SX.btnPrimary, "bg-emerald-600 hover:bg-emerald-700")}
          onClick={onConfirm}
        >
          Yes, Enroll
        </button>
      </div>
    </dialog>
  );
}

function InstructionsCell({
  lead,
  width,
  tone,
}: {
  lead: Lead;
  width: number;
  tone: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cellRef = useRef<HTMLDivElement>(null);

  // Get follow-up data from pipelineMeta
  const followUpData = (lead.pipelineMeta as any)?.followUp;

  // Check if lead has follow-up data
  const hasFollowUpData = Boolean(
    lead.followUpDate?.trim() || 
    followUpData?.reason?.trim() || 
    followUpData?.notes?.trim()
  );

  // Format follow-up date
  const formattedDate = lead.followUpDate?.trim() 
    ? format(parseISO(lead.followUpDate), "dd-MM-yyyy")
    : null;

  // Format reminder time
  const reminderTime = followUpData?.reminderTime?.trim() || "7:00 AM";

  useEffect(() => {
    if (!showTooltip) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current?.contains(e.target as Node)) return;
      if (cellRef.current?.contains(e.target as Node)) return;
      setShowTooltip(false);
    };

    const handleScroll = () => setShowTooltip(false);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTooltip(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [showTooltip]);

  // Update tooltip position when shown
  useEffect(() => {
    if (showTooltip && cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + 4,
        left: Math.min(rect.left, window.innerWidth - 320),
      });
    }
  }, [showTooltip]);

  if (!hasFollowUpData) {
    return (
      <td
        style={{ width }}
        className={cn("border border-slate-200/80 px-2 py-1.5 text-center", tone)}
      >
        <span className="text-slate-400">-</span>
      </td>
    );
  }

  return (
    <td
      style={{ width }}
      className={cn("border border-slate-200/80 px-2 py-1.5", tone)}
    >
      <div className="relative" ref={cellRef}>
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 hover:underline text-[12px] font-medium"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
        >
          Instructions
        </button>

        {showTooltip && typeof document !== 'undefined' && createPortal(
          <div
            ref={tooltipRef}
            className="fixed z-[250] rounded-none border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/15 max-w-xs"
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
          >
            <div className="space-y-2 text-[12px]">
              {formattedDate && (
                <div>
                  <span className="font-semibold text-slate-700">Follow-up date:</span>
                  <div className="text-slate-600">{formattedDate}</div>
                </div>
              )}
              
              {followUpData?.reminderTime?.trim() && (
                <div>
                  <span className="font-semibold text-slate-700">Reminder time:</span>
                  <div className="text-slate-600">{reminderTime}</div>
                </div>
              )}

              {followUpData?.reason?.trim() && (
                <div>
                  <span className="font-semibold text-slate-700">Follow-up reason:</span>
                  <div className="text-slate-600">{followUpData.reason.trim()}</div>
                </div>
              )}

              {followUpData?.notes?.trim() && (
                <div>
                  <span className="font-semibold text-slate-700">Quick notes:</span>
                  <div className="text-slate-600 whitespace-pre-wrap">{followUpData.notes.trim()}</div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    </td>
  );
}
