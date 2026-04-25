import { format, isValid, parse } from "date-fns";
import type { Lead, RowTone, SheetTabId } from "./types";
import { formatTargetExams } from "./lead-display";

/** Lowercase headers — export and import round-trip (case-insensitive on import). Order matches All Leads template + additional Lead Dashboard fields. */
export const LEAD_CSV_EXPORT_HEADERS = [
  "parent name",
  "email",
  "phone",
  "class",
  "country",
  "course",
  "date",
  "student name",
  "data type",
  "status",
  "follow-up",
] as const;

export type LeadImportColumnKey =
  | "date"
  | "studentName"
  | "parentName"
  | "dataType"
  | "grade"
  | "targetExams"
  | "country"
  | "phone"
  | "email"
  | "rowTone"
  | "followUpDate"
  | "pipelineSteps"
  | "sheetTab";

export type ParsedImportLead = Omit<Lead, "id">;

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Trim and collapse internal whitespace; lowercase for matching. */
export function normalizeImportHeader(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim().replace(/\s+/g, " ").toLowerCase();
}

function compactHeader(n: string): string {
  return n.replace(/[\s_\-().]/g, "");
}

const HEADER_ALIASES: [string, LeadImportColumnKey][] = [
  ["date", "date"],
  ["lead date", "date"],
  ["intake date", "date"],
  ["created", "date"],
  ["created date", "date"],
  ["student name", "studentName"],
  ["student", "studentName"],
  ["name", "studentName"],
  ["full name", "studentName"],
  ["learner", "studentName"],
  ["parent name", "parentName"],
  ["parent", "parentName"],
  ["guardian name", "parentName"],
  ["guardian", "parentName"],
  ["email", "email"],
  ["email id", "email"],
  ["emailid", "email"],
  ["email address", "email"],
  ["mail", "email"],
  ["data type", "dataType"],
  ["datatype", "dataType"],
  ["data_type", "dataType"],
  ["source", "dataType"],
  ["channel", "dataType"],
  ["lead type", "dataType"],
  ["grade", "grade"],
  ["class", "grade"],
  ["target (exams)", "targetExams"],
  ["target exams", "targetExams"],
  ["targets", "targetExams"],
  ["exams", "targetExams"],
  ["target", "targetExams"],
  ["target exam", "targetExams"],
  ["course", "targetExams"],
  ["courses", "targetExams"],
  ["programme", "targetExams"],
  ["program", "targetExams"],
  ["stream", "targetExams"],
  ["exam targets", "targetExams"],
  ["country", "country"],
  ["phone", "phone"],
  ["mobile", "phone"],
  ["telephone", "phone"],
  ["tel", "phone"],
  ["contact", "phone"],
  ["status", "rowTone"],
  ["row tone", "rowTone"],
  ["rowtone", "rowTone"],
  ["pipeline status", "rowTone"],
  ["follow-up", "followUpDate"],
  ["follow up", "followUpDate"],
  ["followup", "followUpDate"],
  ["follow-up date", "followUpDate"],
  ["follow up date", "followUpDate"],
  ["followupdate", "followUpDate"],
  ["next follow-up", "followUpDate"],
  ["next follow up", "followUpDate"],
  ["pipeline steps", "pipelineSteps"],
  ["pipeline", "pipelineSteps"],
  ["steps", "pipelineSteps"],
  ["sheet", "sheetTab"],
  ["sheet tab", "sheetTab"],
  ["tab", "sheetTab"],
  ["list", "sheetTab"],
];

const HEADER_LOOKUP = (() => {
  const m = new Map<string, LeadImportColumnKey>();
  for (const [alias, key] of HEADER_ALIASES) {
    const n = normalizeImportHeader(alias);
    const c = compactHeader(n);
    if (!m.has(n)) m.set(n, key);
    if (!m.has(c)) m.set(c, key);
  }
  for (const h of LEAD_CSV_EXPORT_HEADERS) {
    const n = normalizeImportHeader(h);
    const c = compactHeader(n);
    const key = headerToKey(h);
    if (key) {
      if (!m.has(n)) m.set(n, key);
      if (!m.has(c)) m.set(c, key);
    }
  }
  return m;
})();

function headerToKey(h: string): LeadImportColumnKey | null {
  const n = normalizeImportHeader(h);
  if (n === "parent name") return "parentName";
  if (n === "email") return "email";
  if (n === "phone") return "phone";
  if (n === "class") return "grade";
  if (n === "country") return "country";
  if (n === "course") return "targetExams";
  if (n === "date") return "date";
  if (n === "student name") return "studentName";
  if (n === "data type") return "dataType";
  if (n === "status") return "rowTone";
  if (n === "follow-up") return "followUpDate";
  return null;
}

export function mapImportHeader(raw: string): LeadImportColumnKey | null {
  const n = normalizeImportHeader(raw);
  if (!n) return null;
  const c = compactHeader(n);
  return HEADER_LOOKUP.get(n) ?? HEADER_LOOKUP.get(c) ?? null;
}

export function indexImportColumns(headers: string[]): Partial<
  Record<LeadImportColumnKey, number>
> {
  const idx: Partial<Record<LeadImportColumnKey, number>> = {};
  headers.forEach((h, i) => {
    const k = mapImportHeader(h);
    if (k != null && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

function cell(
  row: string[],
  idx: Partial<Record<LeadImportColumnKey, number>>,
  key: LeadImportColumnKey,
): string {
  const i = idx[key];
  if (i === undefined || i < 0) return "";
  return (row[i] ?? "").trim();
}

/** Excel serial day number → ISO date (UTC). */
function excelSerialToIso(n: number): string | null {
  if (!Number.isFinite(n)) return null;
  const ms = (n - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (!isValid(d)) return null;
  return format(d, "yyyy-MM-dd");
}

export function parseLeadDateValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20000 && value < 100000) {
      const iso = excelSerialToIso(value);
      if (iso) return iso;
    }
    return null;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  for (const fmt of ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "MM/dd/yyyy", "M/d/yyyy"]) {
    const d = parse(s, fmt, new Date());
    if (isValid(d)) return format(d, "yyyy-MM-dd");
  }
  const asNum = Number(s.replace(/,/g, ""));
  if (Number.isFinite(asNum) && asNum > 20000 && asNum < 100000) {
    return excelSerialToIso(asNum);
  }
  return null;
}

export function parseTargetExamsValue(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function parseRowToneValue(raw: string): RowTone {
  const t = raw.trim().toLowerCase().replace(/[\s_]+/g, " ");
  const compact = t.replace(/[^a-z]/g, "");
  if (!compact || compact === "new") return "new";
  if (compact === "interested") return "interested";
  if (compact === "notinterested" || t.includes("not interested"))
    return "not_interested";
  if (compact === "followuplater" || t.includes("follow-up later") || t === "followup later")
    return "followup_later";
  if (
    compact.includes("called") &&
    (compact.includes("noresponse") || compact.includes("response"))
  )
    return "called_no_response";
  if (t === "followup" || t === "follow-up" || t === "follow up")
    return "followup_later";
  const snake = raw.trim() as RowTone;
  if (
    snake === "interested" ||
    snake === "not_interested" ||
    snake === "followup_later" ||
    snake === "new" ||
    snake === "called_no_response"
  )
    return snake;
  return "new";
}

function parseSheetTabValue(raw: string): SheetTabId | null {
  const t = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!t) return null;
  if (t === "today" || t === "todaysdata" || t === "intake") return "today";
  if (t === "ongoing" || t === "open") return "ongoing";
  if (t === "followup" || t === "followups" || t === "follow-up" || t === "follow")
    return "followup";
  if (t === "notinterested") return "not_interested";
  if (t === "converted" || t === "convert" || t === "won") return "converted";
  return null;
}

function parsePipelineStepsValue(raw: string): number {
  const n = parseInt(raw.replace(/\D/g, ""), 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(4, n));
}

const ROW_TONE_EXPORT: Record<RowTone, string> = {
  new: "new",
  interested: "interested",
  not_interested: "not interested",
  followup_later: "follow-up later",
  called_no_response: "called / no response",
};

export function leadToExportRow(lead: Lead): string[] {
  return [
    lead.parentName || "",
    lead.email || "",
    lead.phone || "",
    lead.grade || "",
    lead.country || "",
    formatTargetExams(lead.targetExams).replace(/^—$/, ""),
    lead.date,
    lead.studentName,
    lead.dataType,
    ROW_TONE_EXPORT[lead.rowTone],
    lead.followUpDate ?? "",
  ];
}

export function leadsToExportCsv(leads: Lead[]): string {
  const headerLine = LEAD_CSV_EXPORT_HEADERS.map(csvEscape).join(",");
  const lines = leads.map((l) =>
    leadToExportRow(l).map((c) => csvEscape(String(c))).join(","),
  );
  return [headerLine, ...lines].join("\r\n");
}

/** Header row only — same columns as export; add rows and import. */
export function buildLeadCsvTemplate(): string {
  const headerLine = LEAD_CSV_EXPORT_HEADERS.map(csvEscape).join(",");
  return headerLine;
}

/** Browser-only: triggers download of the import template CSV. Call from client components only. */
export function downloadLeadCsvTemplateFile(): void {
  if (typeof document === "undefined") return;
  const csv = buildLeadCsvTemplate();
  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-import-template_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Detect `;` vs `,` from first line (Excel “CSV UTF-8” in some locales uses `;`). */
function detectCsvDelimiter(t: string): "," | ";" {
  const line = t.split(/\r\n|\r|\n/, 1)[0] ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** RFC-style CSV parser with quoted fields. */
export function parseCsvText(text: string): string[][] {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const delim = detectCsvDelimiter(t);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const next = t[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(cur);
      cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row.map((cell) => String(cell).trim()));
      }
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => String(cell).trim() !== "")) {
    rows.push(row.map((cell) => String(cell).trim()));
  }
  return rows;
}

export type ImportParseIssue = { row: number; message: string };

export function matrixToStringGrid(
  aoa: (string | number | null | undefined)[][],
): string[][] {
  const maxLen = Math.max(0, ...aoa.map((r) => r?.length ?? 0));
  return aoa.map((r) => {
    const row = (r ?? []).map((c) => {
      if (c == null || c === "") return "";
      if (typeof c === "number") return String(c);
      return String(c).trim();
    });
    while (row.length < maxLen) row.push("");
    return row;
  });
}

function inferSheetTab(
  rowTone: RowTone,
  followUpDate: string | null,
  explicit: SheetTabId | null,
): SheetTabId {
  if (rowTone === "not_interested") return "not_interested";
  if (followUpDate) return "followup";
  /** New intakes always go to Today's Data (ignore spreadsheet `ongoing` + New). */
  if (rowTone === "new") return "today";
  if (explicit) return explicit;
  return "ongoing";
}

export function parseLeadImportRows(
  grid: string[][],
): { leads: ParsedImportLead[]; issues: ImportParseIssue[] } {
  const issues: ImportParseIssue[] = [];
  if (!grid.length) {
    issues.push({ row: 0, message: "File is empty." });
    return { leads: [], issues };
  }
  const headers = grid[0] ?? [];
  const idx = indexImportColumns(headers);
  if (idx.studentName === undefined && idx.phone === undefined) {
    issues.push({
      row: 1,
      message:
        "No recognizable columns. Use headers like: parent name, email, phone, class, country, course, date, student name, data type, status, follow-up (any case).",
    });
    return { leads: [], issues };
  }
  const leads: ParsedImportLead[] = [];
  const today = format(new Date(), "yyyy-MM-dd");
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    if (!row.some((c) => c.trim())) continue;
    const studentNameRaw = cell(row, idx, "studentName");
    const phoneRaw = cell(row, idx, "phone");
    const studentName = studentNameRaw || "Unknown";
    const dateRaw = cell(row, idx, "date");
    const dateParsed = dateRaw ? parseLeadDateValue(dateRaw) : null;
    const date = dateParsed ?? today;
    const parentName = cell(row, idx, "parentName").trim();
    const email = cell(row, idx, "email").trim();
    const dataType = cell(row, idx, "dataType").trim() || "Organic";
    const grade = cell(row, idx, "grade").trim() || "12th";
    const targetExams = parseTargetExamsValue(cell(row, idx, "targetExams"));
    const country = cell(row, idx, "country").trim() || "India";
    const phoneNorm = phoneRaw.replace(/\s+/g, "");
    const rowTone = parseRowToneValue(cell(row, idx, "rowTone"));
    const followRaw = cell(row, idx, "followUpDate");
    const followUpDate = followRaw ? parseLeadDateValue(followRaw) : null;
    const pipelineSteps = parsePipelineStepsValue(cell(row, idx, "pipelineSteps"));
    const sheetTabParsed = parseSheetTabValue(cell(row, idx, "sheetTab"));
    const sheetTab = inferSheetTab(rowTone, followUpDate, sheetTabParsed);
    leads.push({
      date,
      followUpDate,
      studentName,
      parentName,
      email,
      dataType,
      grade,
      targetExams,
      country,
      phone: phoneNorm,
      pipelineSteps,
      rowTone,
      sheetTab,
    });
  }
  if (leads.length === 0 && issues.length === 0) {
    issues.push({ row: 0, message: "No data rows found after the header." });
  }
  return { leads, issues };
}
