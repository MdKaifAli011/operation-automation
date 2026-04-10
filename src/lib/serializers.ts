import type { Types } from "mongoose";
import type { Lead, Faculty, FeeRecord } from "@/lib/types";
import { computePipelineStepsFromMeta } from "@/lib/pipeline";

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
  const email = doc.email?.trim();
  const meta =
    doc.pipelineMeta &&
    typeof doc.pipelineMeta === "object" &&
    !Array.isArray(doc.pipelineMeta)
      ? (doc.pipelineMeta as Record<string, unknown>)
      : null;
  const rawLog = doc.activityLog;
  const activityLog = Array.isArray(rawLog)
    ? (rawLog as Lead["activityLog"])
    : undefined;
  const rawCalls = doc.callHistory;
  const callHistory = Array.isArray(rawCalls)
    ? (rawCalls as Lead["callHistory"])
    : undefined;
  const pipelineSteps =
    meta != null
      ? computePipelineStepsFromMeta(meta)
      : (doc.pipelineSteps ?? 0);
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
    email: email || null,
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
  subjects: string[];
  phone: string;
  email: string;
  active: boolean;
  qualification: string;
  experience: number;
  joined: string;
}): Faculty {
  return {
    id: String(doc._id),
    name: doc.name,
    subjects: [...(doc.subjects ?? [])],
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
