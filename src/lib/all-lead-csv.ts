import { format } from "date-fns";
import type { AllLeadDocument } from "@/models/AllLead";
import { formatTargetExams } from "./lead-display";

/** CSV headers for All Leads import/export - order: Parent Name | Email | Phone Number | Class | Country | Course */
export const ALL_LEAD_CSV_EXPORT_HEADERS = [
  "parent name",
  "email",
  "phone number",
  "class",
  "country",
  "course",
] as const;

export type AllLeadImportColumnKey =
  | "parentName"
  | "email"
  | "phone"
  | "grade"
  | "country"
  | "targetExams";

export type ParsedImportAllLead = Omit<AllLeadDocument, "_id" | "createdAt" | "updatedAt">;

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

const HEADER_ALIASES: [string, AllLeadImportColumnKey][] = [
  ["parent name", "parentName"],
  ["parent", "parentName"],
  ["guardian name", "parentName"],
  ["guardian", "parentName"],
  ["email", "email"],
  ["email id", "email"],
  ["emailid", "email"],
  ["email address", "email"],
  ["mail", "email"],
  ["phone number", "phone"],
  ["phone", "phone"],
  ["mobile", "phone"],
  ["telephone", "phone"],
  ["tel", "phone"],
  ["contact", "phone"],
  ["class", "grade"],
  ["grade", "grade"],
  ["country", "country"],
  ["course", "targetExams"],
  ["courses", "targetExams"],
  ["target exams", "targetExams"],
  ["target (exams)", "targetExams"],
  ["exams", "targetExams"],
  ["target", "targetExams"],
  ["programme", "targetExams"],
  ["program", "targetExams"],
];

const HEADER_LOOKUP = (() => {
  const m = new Map<string, AllLeadImportColumnKey>();
  for (const [alias, key] of HEADER_ALIASES) {
    const n = normalizeImportHeader(alias);
    const c = compactHeader(n);
    if (!m.has(n)) m.set(n, key);
    if (!m.has(c)) m.set(c, key);
  }
  for (const h of ALL_LEAD_CSV_EXPORT_HEADERS) {
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

function headerToKey(h: string): AllLeadImportColumnKey | null {
  const n = normalizeImportHeader(h);
  if (n === "parent name") return "parentName";
  if (n === "email") return "email";
  if (n === "phone number") return "phone";
  if (n === "class") return "grade";
  if (n === "country") return "country";
  if (n === "course") return "targetExams";
  return null;
}

export function mapImportHeader(raw: string): AllLeadImportColumnKey | null {
  const n = normalizeImportHeader(raw);
  if (!n) return null;
  const c = compactHeader(n);
  return HEADER_LOOKUP.get(n) ?? HEADER_LOOKUP.get(c) ?? null;
}

export function indexImportColumns(headers: string[]): Partial<
  Record<AllLeadImportColumnKey, number>
> {
  const idx: Partial<Record<AllLeadImportColumnKey, number>> = {};
  headers.forEach((h, i) => {
    const k = mapImportHeader(h);
    if (k != null && idx[k] === undefined) idx[k] = i;
  });
  return idx;
}

function cell(
  row: string[],
  idx: Partial<Record<AllLeadImportColumnKey, number>>,
  key: AllLeadImportColumnKey,
): string {
  const i = idx[key];
  if (i === undefined || i < 0) return "";
  return (row[i] ?? "").trim();
}

export function parseTargetExamsValue(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,;|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function allLeadToExportRow(lead: AllLeadDocument): string[] {
  return [
    lead.parentName || "",
    lead.email || "",
    lead.phone || "",
    lead.grade || "",
    lead.country || "",
    formatTargetExams(lead.targetExams).replace(/^—$/, ""),
  ];
}

export function allLeadsToExportCsv(leads: AllLeadDocument[]): string {
  const headerLine = ALL_LEAD_CSV_EXPORT_HEADERS.map(csvEscape).join(",");
  const lines = leads.map((l) =>
    allLeadToExportRow(l).map((c) => csvEscape(String(c))).join(","),
  );
  return [headerLine, ...lines].join("\r\n");
}

/** Header row only — same columns as export; add rows and import. */
export function buildAllLeadCsvTemplate(): string {
  const headerLine = ALL_LEAD_CSV_EXPORT_HEADERS.map(csvEscape).join(",");
  return headerLine;
}

/** Browser-only: triggers download of the import template CSV. Call from client components only. */
export function downloadAllLeadCsvTemplateFile(): void {
  if (typeof document === "undefined") return;
  const csv = buildAllLeadCsvTemplate();
  const blob = new Blob(["\ufeff", csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `all-leads-import-template_${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Detect `;` vs `,` from first line (Excel "CSV UTF-8" in some locales uses `;`). */
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

export function parseAllLeadImportRows(
  grid: string[][],
): { leads: ParsedImportAllLead[]; issues: ImportParseIssue[] } {
  const issues: ImportParseIssue[] = [];
  if (!grid.length) {
    issues.push({ row: 0, message: "File is empty." });
    return { leads: [], issues };
  }
  const headers = grid[0] ?? [];
  const idx = indexImportColumns(headers);
  if (idx.parentName === undefined && idx.phone === undefined && idx.email === undefined) {
    issues.push({
      row: 1,
      message:
        "No recognizable columns. Use headers like: parent name, email, phone number, class, country, course (any case).",
    });
    return { leads: [], issues };
  }
  const leads: ParsedImportAllLead[] = [];
  const today = format(new Date(), "yyyy-MM-dd");
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r] ?? [];
    if (!row.some((c) => c.trim())) continue;
    const parentName = cell(row, idx, "parentName").trim();
    const email = cell(row, idx, "email").trim();
    const phoneRaw = cell(row, idx, "phone");
    const phoneNorm = phoneRaw.replace(/\s+/g, "");
    const grade = cell(row, idx, "grade").trim() || "12th";
    const country = cell(row, idx, "country").trim() || "India";
    const targetExams = parseTargetExamsValue(cell(row, idx, "targetExams"));
    
    // Generate student name from parent name if not provided
    const studentName = parentName || "Add Student Name";
    
    leads.push({
      date: today,
      followUpDate: null,
      studentName,
      parentName,
      dataType: "Organic",
      grade,
      targetExams,
      country,
      phone: phoneNorm,
      email,
      parentEmail: "",
      pipelineSteps: 0,
      rowTone: "new",
      sheetTab: "today",
      notInterestedRemark: null,
    });
  }
  if (leads.length === 0 && issues.length === 0) {
    issues.push({ row: 0, message: "No data rows found after the header." });
  }
  return { leads, issues };
}
