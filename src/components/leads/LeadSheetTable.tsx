"use client";

import { format, parseISO } from "date-fns";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Lead } from "@/lib/types";
import { COURSE_OPTIONS } from "@/lib/mock-data";
import { cn } from "@/lib/cn";
import { rowToneBg } from "./row-styles";
import { PipelineDots } from "./PipelineDots";

const COL_KEYS = [
  "date",
  "studentName",
  "parentName",
  "counsellor",
  "course",
  "phone",
] as const;
type ColKey = (typeof COL_KEYS)[number];

const DEFAULT_WIDTHS: Record<string, number> = {
  idx: 52,
  date: 118,
  studentName: 176,
  parentName: 140,
  counsellor: 110,
  course: 108,
  phone: 132,
  status: 128,
  action: 56,
};

type EditTarget = { leadId: string; field: ColKey | "pipeline" } | null;

type Props = {
  leads: Lead[];
  onUpdateLead: (id: string, patch: Partial<Lead>) => void;
  selectedIds: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onSelectAll: (checked: boolean, visibleIds: string[]) => void;
  visibleIds: string[];
};

export function LeadSheetTable({
  leads,
  onUpdateLead,
  selectedIds,
  onToggleRow,
  onSelectAll,
  visibleIds,
}: Props) {
  const baseId = useId();
  const [widths, setWidths] = useState(DEFAULT_WIDTHS);
  const [resize, setResize] = useState<{
    key: string;
    startX: number;
    startW: number;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    leadId: string;
    field: ColKey;
  } | null>(null);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (tableRef.current?.contains(t)) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openMenuId]);

  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const stickyLeft = useMemo(() => {
    const w = widths;
    return {
      idx: 0,
      date: w.idx,
      studentName: w.idx + w.date,
      phone:
        w.idx +
        w.date +
        w.studentName +
        w.parentName +
        w.counsellor +
        w.course,
    };
  }, [widths]);

  useEffect(() => {
    if (!resize) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - resize.startX;
      const next = Math.max(48, resize.startW + delta);
      setWidths((prev) => ({ ...prev, [resize.key]: next }));
    };
    const onUp = () => setResize(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resize]);

  const moveEdit = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      if (!editing || !editing.field || editing.field === "pipeline") return;
      const idx = leads.findIndex((l) => l.id === editing.leadId);
      const colIdx = COL_KEYS.indexOf(editing.field as ColKey);
      if (idx < 0) return;
      if (dir === "down") {
        const n = leads[idx + 1];
        if (n) setEditing({ leadId: n.id, field: editing.field as ColKey });
        return;
      }
      if (dir === "up") {
        const p = leads[idx - 1];
        if (p) setEditing({ leadId: p.id, field: editing.field as ColKey });
        return;
      }
      if (dir === "right") {
        const nc = Math.min(COL_KEYS.length - 1, colIdx + 1);
        setEditing({ leadId: editing.leadId, field: COL_KEYS[nc] });
        return;
      }
      if (dir === "left") {
        const nc = Math.max(0, colIdx - 1);
        setEditing({ leadId: editing.leadId, field: COL_KEYS[nc] });
      }
    },
    [editing, leads],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!editing) return;
      if (e.key === "Escape") {
        setEditing(null);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        moveEdit("down");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        moveEdit(e.shiftKey ? "left" : "right");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, moveEdit]);

  const beginResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    setResize({ key, startX: e.clientX, startW: widths[key] ?? 80 });
  };

  const applyStatus = (lead: Lead, kind: "interested" | "not_interested" | "followup") => {
    if (kind === "interested") {
      onUpdateLead(lead.id, { rowTone: "interested", sheetTab: "ongoing" });
    } else if (kind === "not_interested") {
      onUpdateLead(lead.id, { rowTone: "not_interested", sheetTab: "not_interested" });
    } else {
      onUpdateLead(lead.id, { rowTone: "followup_later", sheetTab: "followup" });
    }
    setOpenMenuId(null);
  };

  return (
    <div className="relative overflow-auto rounded-[6px] border border-[#e0e0e0]">
      <table
        ref={tableRef}
        className="w-max min-w-full border-collapse text-[13px]"
        style={{ tableLayout: "fixed" }}
      >
        <thead className="sticky top-0 z-20 bg-[#f8f9fa] text-[11px] font-medium uppercase tracking-wide text-[#212121]">
          <tr>
            <th
              style={{ width: widths.idx, minWidth: widths.idx }}
              className="sticky left-0 z-30 border border-[#e0e0e0] bg-[#f8f9fa] px-1 py-2 text-center"
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked, visibleIds)}
                aria-label="Select all"
              />
            </th>
            <ResizableTh
              w={widths.date}
              onResizeStart={(ev) => beginResize("date", ev)}
            >
              Date
            </ResizableTh>
            <th
              style={{
                width: widths.studentName,
                minWidth: widths.studentName,
                left: stickyLeft.studentName,
              }}
              className="sticky z-[21] border border-[#e0e0e0] bg-[#f8f9fa] px-2 py-2 text-left"
            >
              <div className="flex items-center justify-between gap-1">
                <span>Student Name</span>
                <span
                  className="w-1 cursor-col-resize select-none"
                  onMouseDown={(e) => beginResize("studentName", e)}
                />
              </div>
            </th>
            <ResizableTh
              w={widths.parentName}
              onResizeStart={(ev) => beginResize("parentName", ev)}
            >
              Parent Name
            </ResizableTh>
            <ResizableTh
              w={widths.counsellor}
              onResizeStart={(ev) => beginResize("counsellor", ev)}
            >
              Counsellor
            </ResizableTh>
            <ResizableTh
              w={widths.course}
              onResizeStart={(ev) => beginResize("course", ev)}
            >
              Course
            </ResizableTh>
            <th
              style={{
                width: widths.phone,
                minWidth: widths.phone,
                left: stickyLeft.phone,
              }}
              className="sticky z-[21] border border-[#e0e0e0] bg-[#f8f9fa] px-2 py-2 text-left"
            >
              <div className="flex items-center justify-between">
                <span>Phone</span>
                <span
                  className="w-1 cursor-col-resize select-none"
                  onMouseDown={(e) => beginResize("phone", e)}
                />
              </div>
            </th>
            <ResizableTh
              w={widths.status}
              onResizeStart={(ev) => beginResize("status", ev)}
            >
              Status
            </ResizableTh>
            <th
              style={{ width: widths.action, minWidth: widths.action }}
              className="border border-[#e0e0e0] bg-[#f8f9fa] px-1 py-2 text-center"
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, rowIndex) => {
            const tone = rowToneBg(lead.rowTone);
            return (
              <tr
                key={lead.id}
                className={cn(
                  "min-h-[40px] border-b border-[#e0e0e0] transition-colors duration-150 hover:bg-[#f5f5f5]",
                  tone,
                )}
              >
                <td
                  style={{ width: widths.idx }}
                  className="sticky left-0 z-10 border border-[#e0e0e0] bg-[#f8f9fa] px-1 py-1 text-center text-xs text-[#757575]"
                >
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.id)}
                      onChange={(e) => onToggleRow(lead.id, e.target.checked)}
                      aria-label={`Select ${lead.studentName}`}
                    />
                    <span>{rowIndex + 1}</span>
                  </div>
                </td>
                <DataCell
                  width={widths.date}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "date"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "date" })
                  }
                  editing={
                    editing?.leadId === lead.id && editing.field === "date"
                  }
                  onEditStart={() =>
                    setEditing({ leadId: lead.id, field: "date" })
                  }
                >
                  {editing?.leadId === lead.id && editing.field === "date" ? (
                    <input
                      type="date"
                      className="w-full rounded-[4px] border border-[#1565c0] bg-white px-1 py-1 text-[13px]"
                      defaultValue={lead.date}
                      onBlur={(e) => {
                        onUpdateLead(lead.id, { date: e.target.value });
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
                      onDoubleClick={() =>
                        setEditing({ leadId: lead.id, field: "date" })
                      }
                    >
                      {format(parseISO(lead.date), "dd/MM/yyyy")}
                    </button>
                  )}
                </DataCell>
                <td
                  style={{
                    width: widths.studentName,
                    minWidth: widths.studentName,
                    left: stickyLeft.studentName,
                  }}
                  className={cn(
                    "sticky z-10 border border-[#e0e0e0] px-2 py-1",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "studentName" })
                  }
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setEditing({ leadId: lead.id, field: "studentName" });
                  }}
                >
                  {editing?.leadId === lead.id &&
                  editing.field === "studentName" ? (
                    <input
                      className="w-full rounded-[4px] border border-[#1565c0] bg-white px-1 py-1 font-semibold"
                      defaultValue={lead.studentName}
                      onBlur={(e) => {
                        onUpdateLead(lead.id, {
                          studentName: e.target.value,
                        });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <Link
                      href={`/students/${lead.id}`}
                      className="font-semibold text-[#1565c0] underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {lead.studentName}
                    </Link>
                  )}
                </td>
                <TextCell
                  lead={lead}
                  field="parentName"
                  width={widths.parentName}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "parentName"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "parentName" })
                  }
                  editing={
                    editing?.leadId === lead.id &&
                    editing.field === "parentName"
                  }
                  onEdit={() =>
                    setEditing({ leadId: lead.id, field: "parentName" })
                  }
                  onCommit={(v) => onUpdateLead(lead.id, { parentName: v })}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                />
                <TextCell
                  lead={lead}
                  field="counsellor"
                  width={widths.counsellor}
                  selected={
                    selectedCell?.leadId === lead.id &&
                    selectedCell.field === "counsellor"
                  }
                  onSelect={() =>
                    setSelectedCell({ leadId: lead.id, field: "counsellor" })
                  }
                  editing={
                    editing?.leadId === lead.id &&
                    editing.field === "counsellor"
                  }
                  onEdit={() =>
                    setEditing({ leadId: lead.id, field: "counsellor" })
                  }
                  onCommit={(v) => onUpdateLead(lead.id, { counsellor: v })}
                  onCancelEdit={() => setEditing(null)}
                  tone={tone}
                />
                <td
                  style={{ width: widths.course }}
                  className={cn(
                    "border border-[#e0e0e0] px-1 py-1",
                    selectedCell?.leadId === lead.id &&
                      selectedCell.field === "course" &&
                      "grid-cell-focus",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "course" })
                  }
                  onDoubleClick={() =>
                    setEditing({ leadId: lead.id, field: "course" })
                  }
                >
                  {editing?.leadId === lead.id && editing.field === "course" ? (
                    <CourseEditor
                      value={lead.course}
                      onCommit={(v) => {
                        onUpdateLead(lead.id, { course: v });
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <span>{lead.course}</span>
                  )}
                </td>
                <td
                  style={{
                    width: widths.phone,
                    minWidth: widths.phone,
                    left: stickyLeft.phone,
                  }}
                  className={cn(
                    "sticky z-10 border border-[#e0e0e0] px-2 py-1",
                    tone,
                  )}
                  onClick={() =>
                    setSelectedCell({ leadId: lead.id, field: "phone" })
                  }
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    setEditing({ leadId: lead.id, field: "phone" });
                  }}
                >
                  {editing?.leadId === lead.id && editing.field === "phone" ? (
                    <input
                      className="w-full rounded-[4px] border border-[#1565c0] bg-white px-1 py-1"
                      defaultValue={lead.phone}
                      onBlur={(e) => {
                        onUpdateLead(lead.id, { phone: e.target.value });
                        setEditing(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <a
                      href={`tel:${lead.phone}`}
                      title="Click to call"
                      className="text-[#1565c0] underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span aria-hidden>📞 </span>
                      {lead.phone}
                    </a>
                  )}
                </td>
                <td
                  style={{ width: widths.status }}
                  className={cn("border border-[#e0e0e0] px-2 py-1", tone)}
                >
                  <PipelineDots completed={lead.pipelineSteps} />
                </td>
                <td
                  style={{ width: widths.action }}
                  className={cn("relative border border-[#e0e0e0] px-0 py-1 text-center", tone)}
                >
                  <button
                    type="button"
                    className="rounded-[4px] px-2 py-1 text-lg leading-none text-[#212121] hover:bg-[#eeeeee]"
                    aria-expanded={openMenuId === lead.id}
                    aria-controls={`${baseId}-menu-${lead.id}`}
                    onClick={() =>
                      setOpenMenuId(openMenuId === lead.id ? null : lead.id)
                    }
                  >
                    ⋮
                  </button>
                  {openMenuId === lead.id && (
                    <div
                      id={`${baseId}-menu-${lead.id}`}
                      className="absolute right-0 top-full z-40 min-w-[180px] rounded-[6px] border border-[#e0e0e0] bg-white py-1 text-left text-sm shadow-none"
                      role="menu"
                    >
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-[#f5f5f5]"
                        onClick={() => applyStatus(lead, "interested")}
                      >
                        Interested
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-[#f5f5f5]"
                        onClick={() => applyStatus(lead, "not_interested")}
                      >
                        Not Interested
                      </button>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-[#f5f5f5]"
                        onClick={() => {
                          setOpenMenuId(null);
                          window.dispatchEvent(
                            new CustomEvent("lead-followup", {
                              detail: { id: lead.id },
                            }),
                          );
                        }}
                      >
                        Follow-up
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResizableTh({
  children,
  w,
  onResizeStart,
}: {
  children: React.ReactNode;
  w: number;
  onResizeStart: (e: React.MouseEvent) => void;
}) {
  return (
    <th
      style={{ width: w, minWidth: w }}
      className="relative border border-[#e0e0e0] bg-[#f8f9fa] px-2 py-2 text-left"
    >
      <div className="flex items-center justify-between gap-1 pr-1">
        <span>{children}</span>
        <span
          className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-[#e3f2fd]"
          onMouseDown={onResizeStart}
        />
      </div>
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
}: {
  children: React.ReactNode;
  width: number;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEditStart: () => void;
}) {
  return (
    <td
      style={{ width, minWidth: width }}
      className={cn(
        "border border-[#e0e0e0] px-1 py-1",
        selected && !editing && "grid-cell-focus",
      )}
      onClick={onSelect}
      onDoubleClick={onEditStart}
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
  onCommit,
  onCancelEdit,
  tone,
}: {
  lead: Lead;
  field: ColKey;
  width: number;
  selected: boolean;
  onSelect: () => void;
  editing: boolean;
  onEdit: () => void;
  onCommit: (v: string) => void;
  onCancelEdit: () => void;
  tone: string;
}) {
  const val = lead[field];
  return (
    <td
      style={{ width, minWidth: width }}
      className={cn(
        "border border-[#e0e0e0] px-2 py-1",
        selected && !editing && "grid-cell-focus",
        tone,
      )}
      onClick={onSelect}
      onDoubleClick={onEdit}
    >
      {editing ? (
        <input
          className="w-full rounded-[4px] border border-[#1565c0] bg-white px-1 py-1"
          defaultValue={val}
          onBlur={(e) => {
            onCommit(e.target.value);
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

function CourseEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState(value);
  return (
    <div className="flex flex-col gap-1">
      <select
        className="w-full rounded-[4px] border border-[#1565c0] bg-white px-1 py-1 text-[13px]"
        value={COURSE_OPTIONS.includes(v as (typeof COURSE_OPTIONS)[number]) ? v : "Other"}
        onChange={(e) => {
          const nv = e.target.value;
          if (nv === "__add") {
            const created = window.prompt("New course name");
            if (created) setV(created);
            return;
          }
          setV(nv);
        }}
      >
        {COURSE_OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value="__add">+ Add New Course</option>
      </select>
      <div className="flex gap-1">
        <button
          type="button"
          className="rounded-[4px] bg-[#2e7d32] px-2 py-0.5 text-xs text-white"
          onClick={() => onCommit(v)}
        >
          OK
        </button>
        <button
          type="button"
          className="text-xs text-[#1565c0] underline"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
