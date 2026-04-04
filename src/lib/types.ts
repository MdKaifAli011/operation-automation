export type SheetTabId = "ongoing" | "followup" | "not_interested" | "converted";

export type RowTone =
  | "interested"
  | "not_interested"
  | "followup_later"
  | "new"
  | "called_no_response";

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
  pipelineSteps: number; // 0–4 completed (Demo → Brochure → Fees → Schedule)
  rowTone: RowTone;
  sheetTab: SheetTabId;
};

export type SortKey =
  | "date"
  | "studentName"
  | "targetExams"
  | "country"
  | "rowTone";
export type SortDir = "asc" | "desc";
