import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type {
  LeadPipelineMilestoneRow,
  LeadPipelineScheduleGuidelines,
  LeadPipelineScheduleProgrammeOverview,
  LeadPipelineWeeklySessionRow,
} from "@/lib/leadPipelineMetaTypes";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 30;
const BODY_W = PAGE_W - MARGIN_X * 2;
const MARGIN_BOTTOM = 34;
const SECTION_GAP = 24;

function safe(input: string | undefined | null): string {
  return String(input ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[•]/g, "-")
    .replace(/[₹]/g, "INR ")
    .replace(/[\u0100-\uFFFF]/g, " ")
    .trim();
}

function wrapLines(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  width: number,
): string[] {
  const cleaned = safe(text);
  if (!cleaned) return [""];
  const words = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) out.push(line);
    line = w;
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}

export async function buildSchedulePlanPdfBytes(opts: {
  studentName: string;
  programmeOverview: LeadPipelineScheduleProgrammeOverview;
  weeklyRows: LeadPipelineWeeklySessionRow[];
  milestones: LeadPipelineMilestoneRow[];
  guidelines: LeadPipelineScheduleGuidelines;
  logoPngBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoImage = opts.logoPngBytes?.length ? await pdf.embedPng(opts.logoPngBytes) : null;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 26;

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN_BOTTOM) {
      addFooter(page, pdf.getPageCount());
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 26;
    }
  };

  const addFooter = (currentPage: any, pageNum: number) => {
    const footerY = 20;
    
    // Footer separator line
    currentPage.drawLine({
      start: { x: MARGIN_X, y: footerY + 8 },
      end: { x: MARGIN_X + BODY_W, y: footerY + 8 },
      thickness: 0.5,
      color: rgb(0.75, 0.8, 0.87),
    });
    
    // Footer text
    currentPage.drawText(
      "This weekly session plan is confidential and prepared exclusively for the mentioned student.",
      {
        x: MARGIN_X,
        y: footerY,
        size: 7,
        font,
        color: rgb(0.45, 0.5, 0.58),
      }
    );
    
    // Page number
    const pageText = `Page ${pageNum}`;
    const pageTextWidth = font.widthOfTextAtSize(pageText, 7);
    currentPage.drawText(pageText, {
      x: MARGIN_X + BODY_W - pageTextWidth,
      y: footerY,
      size: 7,
      font,
      color: rgb(0.45, 0.5, 0.58),
    });
  };

  const drawWrapped = (
    text: string,
    x: number,
    width: number,
    size: number,
    bold = false,
    color = rgb(0.12, 0.14, 0.2),
  ) => {
    const f = bold ? fontBold : font;
    const lines = wrapLines(text, f, size, width);
    for (const line of lines) {
      page.drawText(line, { x, y, size, font: f, color });
      y -= size + 3;
    }
  };

  const drawSectionTitle = (label: string) => {
    ensureSpace(26);
    page.drawText(label, {
      x: MARGIN_X,
      y,
      size: 10.8,
      font: fontBold,
      color: rgb(0.13, 0.24, 0.38),
    });
    y -= 8;
    page.drawLine({
      start: { x: MARGIN_X, y },
      end: { x: MARGIN_X + BODY_W, y },
      thickness: 1,
      color: rgb(0.78, 0.82, 0.87),
    });
    y -= 12;
  };

  const drawTable = (optsTable: {
    headers: string[];
    rows: string[][];
    colWidths: number[];
    headerBg?: [number, number, number];
  }) => {
    const headerBg = optsTable.headerBg ?? [0.12, 0.32, 0.54];
    const rowH = 22;
    const headerH = 22;
    const x0 = MARGIN_X;
    const totalW = optsTable.colWidths.reduce((s, n) => s + n, 0);
    ensureSpace(headerH + optsTable.rows.length * rowH + 8);

    page.drawRectangle({
      x: x0,
      y: y - headerH,
      width: totalW,
      height: headerH,
      color: rgb(headerBg[0], headerBg[1], headerBg[2]),
      borderWidth: 0.8,
      borderColor: rgb(0.56, 0.64, 0.75),
    });
    let cx = x0;
    optsTable.headers.forEach((h, i) => {
      const w = optsTable.colWidths[i] ?? 80;
      page.drawText(safe(h), {
        x: cx + 5,
        y: y - 15,
        size: 9.2,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawLine({
        start: { x: cx, y: y - headerH },
        end: { x: cx, y: y - headerH - optsTable.rows.length * rowH },
        thickness: 0.6,
        color: rgb(0.63, 0.69, 0.77),
      });
      cx += w;
    });
    page.drawLine({
      start: { x: x0 + totalW, y: y - headerH },
      end: { x: x0 + totalW, y: y - headerH - optsTable.rows.length * rowH },
      thickness: 0.6,
      color: rgb(0.63, 0.69, 0.77),
    });

    let ry = y - headerH;
    optsTable.rows.forEach((row, rowIdx) => {
      page.drawRectangle({
        x: x0,
        y: ry - rowH,
        width: totalW,
        height: rowH,
        color: rowIdx % 2 === 0 ? rgb(0.98, 0.99, 1) : rgb(0.94, 0.96, 0.98),
        borderWidth: 0.6,
        borderColor: rgb(0.75, 0.8, 0.87),
      });
      let cellX = x0;
      row.forEach((cell, i) => {
        page.drawText(safe(cell), {
          x: cellX + 5,
          y: ry - 14,
          size: 9,
          font: i === 0 ? fontBold : font,
          color: rgb(0.14, 0.2, 0.3),
        });
        cellX += optsTable.colWidths[i] ?? 80;
      });
      ry -= rowH;
    });
    y = ry - 10;
  };

  // Header
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 34,
    width: BODY_W,
    height: 34,
    color: rgb(0.12, 0.32, 0.54),
  });
  page.drawText("WEEKLY SESSION PLAN", {
    x: MARGIN_X + 12,
    y: y - 21,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  if (logoImage) {
    const maxH = 24;
    const scale = maxH / logoImage.height;
    const w = logoImage.width * scale;
    const h = maxH;
    page.drawImage(logoImage, {
      x: MARGIN_X + BODY_W - w - 8,
      y: y - 30,
      width: w,
      height: h,
    });
  }
  y -= 43;

  const commencement = safe(opts.programmeOverview.startDateLabel);
  const duration = safe(opts.programmeOverview.durationLabel);
  const target = safe(opts.programmeOverview.targetExamLabel);
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 16,
    width: BODY_W,
    height: 16,
    color: rgb(0.18, 0.41, 0.66),
  });
  page.drawText(
    `Session Commencement: ${commencement || "-"}  |  Duration: ${duration || "-"}${target ? ` (up to ${target})` : ""}`,
    {
      x: MARGIN_X + 8,
      y: y - 11,
      size: 8.7,
      font,
      color: rgb(0.95, 0.98, 1),
    },
  );
  y -= 28;
  y -= SECTION_GAP;

  drawSectionTitle("1. Programme Overview");
  drawTable({
    headers: ["Programme", "Start Date", "Duration", "Target Exam"],
    colWidths: [130, 140, 110, BODY_W - 130 - 140 - 110],
    rows: [
      [
        safe(opts.programmeOverview.programmeName) || "Programme",
        commencement || "-",
        duration || "-",
        target || "-",
      ],
    ],
  });
  y -= SECTION_GAP;

  drawSectionTitle("2. Weekly Session Structure");
  const weeklyRows = (opts.weeklyRows.length > 0 ? opts.weeklyRows : []).map((r) => [
    safe(r.sessionLabel),
    safe(r.day),
    safe(r.timeIST),
    safe(r.subject),
    safe(r.sessionDuration),
  ]);
  if (weeklyRows.length > 0) {
    drawTable({
      headers: ["Session", "Day", "Time (IST)", "Subject", "Session Duration"],
      colWidths: [95, 110, 130, 140, BODY_W - 95 - 110 - 130 - 140],
      rows: weeklyRows,
    });
  } else {
    drawWrapped("No weekly session rows configured.", MARGIN_X, BODY_W, 10, false, rgb(0.4, 0.45, 0.52));
    y -= 6;
  }
  y -= SECTION_GAP;

  drawSectionTitle("3. Key Milestones & Examination Timelines");
  const milestoneRows = (opts.milestones.length > 0 ? opts.milestones : []).map((m, i) => [
    String(i + 1),
    safe(m.targetDateLabel),
    safe(m.milestone),
    safe(m.description),
  ]);
  if (milestoneRows.length > 0) {
    drawTable({
      headers: ["#", "Target Date", "Milestone", "Description"],
      colWidths: [26, 140, 150, BODY_W - 26 - 140 - 150],
      rows: milestoneRows,
    });
  } else {
    drawWrapped("No milestones configured.", MARGIN_X, BODY_W, 10, false, rgb(0.4, 0.45, 0.52));
    y -= 6;
  }
  y -= SECTION_GAP;

  drawSectionTitle("4. Study & Preparation Guidelines");
  ensureSpace(44);
  page.drawText("General Guidelines", {
    x: MARGIN_X,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.14, 0.27, 0.44),
  });
  y -= 14;
  for (const line of opts.guidelines.generalGuidelines ?? []) {
    ensureSpace(15);
    page.drawText("- ", {
      x: MARGIN_X + 2,
      y,
      size: 9.3,
      font: fontBold,
      color: rgb(0.12, 0.18, 0.28),
    });
    drawWrapped(line, MARGIN_X + 12, BODY_W - 12, 9.3);
    y -= 1;
  }
  y -= 8;
  ensureSpace(24);
  page.drawText("Mock Tests & Revision Schedule", {
    x: MARGIN_X,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.14, 0.27, 0.44),
  });
  y -= 14;
  for (const line of opts.guidelines.mockTestsRevision ?? []) {
    ensureSpace(15);
    page.drawText("- ", {
      x: MARGIN_X + 2,
      y,
      size: 9.3,
      font: fontBold,
      color: rgb(0.12, 0.18, 0.28),
    });
    drawWrapped(line, MARGIN_X + 12, BODY_W - 12, 9.3);
    y -= 1;
  }

  // Add footer to the last page
  addFooter(page, pdf.getPageCount());

  return pdf.save();
}

