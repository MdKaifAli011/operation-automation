import type { LeadPipelineMeta } from "@/lib/leadPipelineMetaTypes";

export type SheetTabId = "ongoing" | "followup" | "not_interested" | "converted";

export type RowTone =
  | "interested"
  | "not_interested"
  | "followup_later"
  | "new"
  | "called_no_response";

export type PipelineActivityKind =
  | "demo"
  | "brochure"
  | "fees"
  | "schedule"
  | "call"
  | "note";

export type PipelineActivity = {
  /** ISO timestamp */
  at: string;
  kind: PipelineActivityKind;
  message: string;
};

export type CallHistoryEntry = {
  at: string;
  outcome: string;
  duration?: string;
  notes?: string;
};

export type Lead = {
  id: string;
  date: string; // ISO date — lead created / intake date
  /** When sheet is follow-up: date to call or student returns (ISO yyyy-MM-dd). */
  followUpDate: string | null;
  studentName: string;
  parentName: string;
  /** Lead source / channel (CRM data type). */
  dataType: string;
  /** Student class / year. */
  grade: string;
  /** Target exams (NEET, JEE, …) — multi-select in UI. */
  targetExams: string[];
  country: string;
  phone: string;
  /** Optional contact email (stored in DB). */
  email?: string | null;
  /** 0–4: how many of Demo → Brochure → Fees → Schedule are done (dots on lead grid). */
  pipelineSteps: number;
  rowTone: RowTone;
  sheetTab: SheetTabId;
  /**
   * Workspace data for this student — demos, brochure, fees, schedule.
   * Stored in MongoDB (`Lead.pipelineMeta`); see `leadPipelineMetaTypes.ts`.
   */
  pipelineMeta?: LeadPipelineMeta | Record<string, unknown> | null;
  /** Newest-first recommended in UI. */
  activityLog?: PipelineActivity[];
  /** Workspace notes (detail page sidebar). */
  workspaceNotes?: string | null;
  /** Logged calls (newest first). */
  callHistory?: CallHistoryEntry[];
};

export type Faculty = {
  id: string;
  name: string;
  subjects: string[];
  phone: string;
  email: string;
  active: boolean;
  qualification: string;
  experience: number;
  joined: string;
};

export type FeeRecord = {
  id: string;
  studentName: string;
  course: string;
  total: number;
  discount: number;
  final: number;
  paid: number;
  emi: number;
  status: "Paid" | "Partial" | "Pending" | "Overdue";
  leadId?: string | null;
};

export type SortKey =
  | "date"
  | "studentName"
  | "targetExams"
  | "country"
  | "rowTone";
export type SortDir = "asc" | "desc";
