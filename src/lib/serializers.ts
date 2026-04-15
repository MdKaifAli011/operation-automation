import type { Types } from "mongoose";
import type { Lead, Faculty, FeeRecord, PipelineActivity, CallHistoryEntry } from "@/lib/types";
import { computePipelineStepsFromMeta } from "@/lib/pipeline";

/** Strip Mongoose subdoc fields (e.g. `_id`) so the result is RSC → client safe. */
function serializeActivityLog(raw: unknown): PipelineActivity[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: PipelineActivity[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const at =
      typeof o.at === "string"
        ? o.at
        : o.at instanceof Date
          ? o.at.toISOString()
          : "";
    const kind =
      typeof o.kind === "string" && o.kind.length > 0 ? o.kind : "note";
    const message = typeof o.message === "string" ? o.message : "";
    if (!at) continue;
    out.push({
      at,
      kind: kind as PipelineActivity["kind"],
      message,
    });
  }
  return out.length ? out : undefined;
}

function serializeCallHistory(raw: unknown): CallHistoryEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: CallHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const at =
      typeof o.at === "string"
        ? o.at
        : o.at instanceof Date
          ? o.at.toISOString()
          : "";
    if (!at) continue;
    out.push({
      at,
      outcome: typeof o.outcome === "string" ? o.outcome : "",
      duration: typeof o.duration === "string" ? o.duration : undefined,
      notes: typeof o.notes === "string" ? o.notes : "",
    });
  }
  return out.length ? out : undefined;
}

/**
 * Deep-clone pipeline meta to plain JSON data (no BSON / toJSON surprises)
 * for Server → Client Component props.
 */
function serializePipelineMetaPlain(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  try {
    return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
  } catch {
    return { ...(raw as Record<string, unknown>) };
  }
}

export function serializeLead(
  doc: {
    _id: Types.ObjectId | string;
    updatedAt?: Date | string;
    date: string;
    followUpDate: string | null;
    studentName: string;
    parentName?: string;
    dataType: string;
    grade: string;
    targetExams: string[];
    country: string;
    phone: string;
    parentEmail?: string;
    email?: string;
    pipelineSteps: number;
    rowTone: string;
    sheetTab: string;
    pipelineMeta?: unknown;
    activityLog?: unknown;
    workspaceNotes?: string;
    callHistory?: unknown;
    notInterestedRemark?: string | null;
  },
): Lead {
  const parentEmail = doc.parentEmail?.trim();
  const email = doc.email?.trim();
  const metaPlain = serializePipelineMetaPlain(doc.pipelineMeta);
  const meta = metaPlain;
  const pipelineSteps =
    meta != null
      ? computePipelineStepsFromMeta(meta)
      : (doc.pipelineSteps ?? 0);
  const activityLog = serializeActivityLog(doc.activityLog);
  const callHistory = serializeCallHistory(doc.callHistory);
  const updatedAtIso =
    doc.updatedAt != null
      ? new Date(doc.updatedAt as Date | string).toISOString()
      : undefined;
  return {
    id: String(doc._id),
    updatedAt: updatedAtIso,
    date: doc.date,
    followUpDate: doc.followUpDate ?? null,
    studentName: doc.studentName,
    parentName: doc.parentName ?? "",
    dataType: doc.dataType,
    grade: doc.grade,
    targetExams: [...(doc.targetExams ?? [])],
    country: doc.country,
    phone: doc.phone,
    parentEmail: parentEmail || email || null,
    email: email || parentEmail || null,
    pipelineSteps,
    rowTone: doc.rowTone as Lead["rowTone"],
    sheetTab: doc.sheetTab as Lead["sheetTab"],
    pipelineMeta: meta,
    activityLog,
    callHistory,
    workspaceNotes: doc.workspaceNotes?.trim() || null,
    notInterestedRemark:
      typeof doc.notInterestedRemark === "string" &&
      doc.notInterestedRemark.trim().length > 0
        ? doc.notInterestedRemark.trim()
        : null,
  };
}

export function serializeFaculty(doc: {
  _id: Types.ObjectId | string;
  name: string;
  assignments?: { examValue?: string; subjectId?: string }[];
  subjects: string[];
  courses?: string[];
  phone: string;
  email: string;
  active: boolean;
  qualification: string;
  experience: number;
  joined: string;
}): Faculty {
  const rawAssign = Array.isArray(doc.assignments) ? doc.assignments : [];
  const assignments: Faculty["assignments"] = [];
  for (const row of rawAssign) {
    if (!row || typeof row !== "object") continue;
    const examValue =
      typeof row.examValue === "string" ? row.examValue.trim() : "";
    const subjectId =
      typeof row.subjectId === "string" ? row.subjectId.trim() : "";
    if (!examValue || !subjectId) continue;
    assignments.push({ examValue, subjectId });
  }
  return {
    id: String(doc._id),
    name: doc.name,
    assignments,
    subjects: [...(doc.subjects ?? [])],
    courses: [...(doc.courses ?? [])],
    phone: doc.phone,
    email: doc.email,
    active: doc.active,
    qualification: doc.qualification,
    experience: doc.experience,
    joined: doc.joined,
  };
}

export function serializeFeeRecord(doc: {
  _id: Types.ObjectId | string;
  studentName: string;
  course: string;
  total: number;
  discount: number;
  finalAmount: number;
  paid: number;
  emiMonths: number;
  status: string;
  leadId?: Types.ObjectId | string | null;
}): FeeRecord {
  return {
    id: String(doc._id),
    studentName: doc.studentName,
    course: doc.course,
    total: doc.total,
    discount: doc.discount,
    final: doc.finalAmount,
    paid: doc.paid,
    emi: doc.emiMonths,
    status: doc.status as FeeRecord["status"],
    leadId: doc.leadId ? String(doc.leadId) : null,
  };
}
