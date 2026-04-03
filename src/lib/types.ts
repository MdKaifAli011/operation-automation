export type SheetTabId = "ongoing" | "followup" | "not_interested" | "converted";

export type RowTone =
  | "interested"
  | "not_interested"
  | "followup_later"
  | "new"
  | "called_no_response";

export type Lead = {
  id: string;
  date: string; // ISO date
  studentName: string;
  parentName: string;
  counsellor: string;
  course: string;
  phone: string;
  pipelineSteps: number; // 0-5 completed
  rowTone: RowTone;
  sheetTab: SheetTabId;
};

export type SortKey = "date" | "studentName" | "course" | "rowTone";
export type SortDir = "asc" | "desc";
