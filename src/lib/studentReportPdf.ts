import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";

// ============== CONFIGURATION ==============
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 34;
const MARGIN_BOTTOM = 40;
const BODY_W = PAGE_W - MARGIN_X * 2;

const GRID_GAP = 10;
const PAD = 10;

const COLORS = {
  white: rgb(1, 1, 1),
  pageBg: rgb(1, 1, 1),
  lightBg: rgb(0.96, 0.97, 0.98),
  border: rgb(0.82, 0.85, 0.9),
  text: rgb(0.12, 0.14, 0.18),
  muted: rgb(0.45, 0.49, 0.56),
  headerBlue: rgb(0.12, 0.18, 0.3),
  sectionBlue: rgb(0.16, 0.38, 0.86),
  green: rgb(0.0, 0.55, 0.28),
  orange: rgb(0.85, 0.45, 0.05),
  teal: rgb(0.0, 0.53, 0.55),
  purple: rgb(0.49, 0.25, 0.86),
  rowAlt: rgb(0.97, 0.98, 0.99),
  rowBase: rgb(1, 1, 1),
} as const;

const TYPE = {
  title: 18,
  section: 13,
  body: 11,
  small: 10,
} as const;

const LEADING = {
  body: 15,
  small: 14,
} as const;

// ============== UTILITY FUNCTIONS ==============
function safeText(input: string | undefined | null): string {
  return String(input ?? "")
    .replace(/[—–]/g, "-")
    .replace(/[•]/g, "-")
    .replace(/[₹]/g, "INR ")
    .replace(/[\u0100-\uFFFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ratingLabel(v: string | undefined): string {
  const t = safeText(v);
  if (!t) return "Not available";
  const m: Record<string, string> = {
    excellent: "Excellent",
    good: "Good",
    satisfactory: "Satisfactory",
    needs_improvement: "Needs improvement",
  };
  return m[t] ?? t;
}

function wrapToWidth(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxW: number,
): string[] {
  const cleaned = safeText(text);
  if (!cleaned) return [""];
  const words = cleaned.split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    if (font.widthOfTextAtSize(w, size) <= maxW) {
      line = w;
      continue;
    }
    let chunk = "";
    for (const ch of w) {
      const t = chunk + ch;
      if (font.widthOfTextAtSize(t, size) <= maxW) chunk = t;
      else {
        if (chunk) lines.push(chunk);
        chunk = ch;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function fmtDate(iso: string | undefined): string {
  const t = safeText(iso);
  if (!t) return "Not available";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateReportId(): string {
  return `RPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

// ============== PDF GENERATION ==============
export async function buildStudentReportPdfBytes(opts: {
  studentName: string;
  demoRows: DemoTableRowPersisted[];
  additionalNotes: string;
  recommendations: string;
  manualQuestionsAttempted?: string;
  manualCorrectAnswers?: string;
  manualStudentLevel?: string;
  reportSource?: "teacher_feedback" | "manual_sales" | "uploaded_custom";
  logoPngBytes?: Uint8Array | null;
  generatedAtIso?: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoImage = opts.logoPngBytes?.length
    ? await pdf.embedPng(opts.logoPngBytes)
    : null;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 24;
  const reportId = generateReportId();

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN_BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 24;
    }
  };

  const line = (h = 1, c = COLORS.border) => {
    ensureSpace(10);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 6,
      width: BODY_W,
      height: h,
      color: c,
    });
    y -= 12;
  };

  const wrapToWidthLocal = (
    text: string,
    f: { widthOfTextAtSize: (t: string, s: number) => number },
    size: number,
    maxW: number,
  ) => wrapToWidth(text, f, size, maxW);

  const drawParagraph = (
    text: string,
    x: number,
    maxW: number,
    size: number = TYPE.body,
    bold = false,
    color = COLORS.text,
    leading = 12,
  ) => {
    const f = bold ? fontBold : font;
    const lines = wrapToWidthLocal(text, f, size, maxW);
    for (const ln of lines) {
      ensureSpace(leading + 2);
      page.drawText(ln, { x, y, size, font: f, color });
      y -= leading;
    }
  };

  const measureParagraphH = (
    text: string,
    maxW: number,
    size: number = TYPE.body,
    bold = false,
    leading = 12,
  ) => {
    const f = bold ? fontBold : font;
    const lines = wrapToWidthLocal(text, f, size, maxW);
    return Math.max(leading, lines.length * leading);
  };

  const drawSectionHeader = (title: string, color = COLORS.sectionBlue) => {
    ensureSpace(26);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 18,
      width: BODY_W,
      height: 18,
      color,
    });
    page.drawText(title.toUpperCase(), {
      x: MARGIN_X + 10,
      y: y - 13,
      size: TYPE.section,
      font: fontBold,
      color: COLORS.white,
    });
    y -= 26;
  };

  const drawCard = (
    x: number,
    yTop: number,
    w: number,
    h: number,
    bg = COLORS.lightBg,
    border = COLORS.border,
  ) => {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      color: bg,
      borderWidth: 0.8,
      borderColor: border,
    });
  };

  const drawKeyValueGrid2 = (
    x: number,
    yTop: number,
    w: number,
    items: Array<{ label: string; value: string }>,
  ) => {
    const colW = (w - GRID_GAP) / 2;
    const rowH = 30;
    const rows = Math.ceil(items.length / 2);
    const h = rows * rowH + PAD * 2;
    drawCard(x, yTop, w, h, COLORS.lightBg);
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x0 = x + PAD + col * (colW + GRID_GAP);
      const y0 = yTop - PAD - row * rowH;
      page.drawText(safeText(it.label).toUpperCase(), {
        x: x0,
        y: y0 - 12,
        size: 9,
        font,
        color: COLORS.muted,
      });
      const v = safeText(it.value) || "-";
      const vMaxW = colW - PAD;
      const vLines = wrapToWidthLocal(v, fontBold, 11, vMaxW);
      const vFirst = vLines[0] || "-";
      page.drawText(vFirst, {
        x: x0,
        y: y0 - 27,
        size: 11,
        font: fontBold,
        color: COLORS.text,
      });
    }
    return h;
  };

  const ratingDots = (value: number, x: number, yText: number) => {
    const dotSize = 6;
    const gap = 3;
    for (let i = 0; i < 5; i++) {
      const filled = i < value;
      page.drawEllipse({
        x: x + i * (dotSize + gap) + dotSize / 2,
        y: yText + 2,
        xScale: dotSize / 2,
        yScale: dotSize / 2,
        color: filled ? COLORS.green : rgb(0.83, 0.85, 0.88),
      });
    }
  };

  const scoreToLevel = (ratingRaw: string | undefined): number => {
    const t = safeText(ratingRaw).toLowerCase();
    if (t.includes("excellent")) return 5;
    if (t.includes("good")) return 4;
    if (t.includes("satisfactory")) return 3;
    if (t.includes("needs") || t.includes("improvement")) return 2;
    return 3;
  };

  const drawPerformanceTable = (rows: Array<{
    parameter: string;
    rating: number;
    scoreLabel: string;
    interpretation: string;
    tone?: "good" | "warn";
  }>) => {
    const headerH = 22;
    const rowH = 26;
    const tableH = headerH + rows.length * rowH;
    ensureSpace(tableH + 10);

    // header background
    page.drawRectangle({
      x: MARGIN_X,
      y: y - headerH,
      width: BODY_W,
      height: headerH,
      color: rgb(0.2, 0.25, 0.33),
    });
    const cols = {
      p: MARGIN_X + 10,
      r: MARGIN_X + 210,
      s: MARGIN_X + 310,
      i: MARGIN_X + 380,
    };
    const head = (t: string, x: number) =>
      page.drawText(t.toUpperCase(), {
        x,
        y: y - 16,
        size: 9,
        font: fontBold,
        color: rgb(0.8, 0.84, 0.9),
      });
    head("Parameter", cols.p);
    head("Rating", cols.r);
    head("Score", cols.s);
    head("Interpretation", cols.i);

    let yRowTop = y - headerH;
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx]!;
      const bg = idx % 2 === 0 ? COLORS.rowBase : COLORS.rowAlt;
      page.drawRectangle({
        x: MARGIN_X,
        y: yRowTop - rowH,
        width: BODY_W,
        height: rowH,
        color: bg,
        borderWidth: 0.4,
        borderColor: COLORS.border,
      });
      const tone = r.tone === "warn" ? COLORS.orange : COLORS.green;
      page.drawText(safeText(r.parameter), {
        x: cols.p,
        y: yRowTop - 18,
        size: 10,
        font,
        color: COLORS.text,
      });
      ratingDots(Math.max(0, Math.min(5, r.rating)), cols.r, yRowTop - 18);
      page.drawText(safeText(r.scoreLabel), {
        x: cols.s,
        y: yRowTop - 18,
        size: 10,
        font: fontBold,
        color: tone,
      });
      // interpretation: wrap to remaining width
      const interpX = cols.i;
      const interpMaxW = MARGIN_X + BODY_W - PAD - interpX;
      const interpLines = wrapToWidthLocal(r.interpretation, font, 9, interpMaxW);
      page.drawText(interpLines[0] || "", {
        x: interpX,
        y: yRowTop - 18,
        size: 9,
        font,
        color: COLORS.muted,
      });
      yRowTop -= rowH;
    }
    y = yRowTop - 10;
  };

  const feedbackRows = opts.demoRows.filter((r) =>
    Boolean(r.teacherFeedbackSubmittedAt?.trim()),
  );
  const firstRow = feedbackRows[0];

  // ============== HEADER (BANNER) ==============
  const headerH = 70;
  page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH,
    width: PAGE_W,
    height: headerH,
    color: COLORS.headerBlue,
  });
  page.drawText("STUDENT TRIAL REPORT", {
    x: PAGE_W / 2 - fontBold.widthOfTextAtSize("STUDENT TRIAL REPORT", TYPE.title) / 2,
    y: PAGE_H - 28,
    size: TYPE.title,
    font: fontBold,
    color: COLORS.white,
  });
  const subtitle = "Confidential - Internal Use - EduReach Learning Institute";
  page.drawText(subtitle, {
    x: PAGE_W / 2 - font.widthOfTextAtSize(subtitle, TYPE.small) / 2,
    y: PAGE_H - 46,
    size: TYPE.small,
    font,
    color: rgb(0.8, 0.86, 0.92),
  });
  if (logoImage) {
    const maxW = 84;
    const maxH = 30;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    page.drawImage(logoImage, {
      x: PAGE_W - MARGIN_X - w,
      y: PAGE_H - 38,
      width: w,
      height: h,
    });
  }

  y = PAGE_H - headerH - 14;
  const meta = `Report ID: ${reportId}   Generated: ${fmtDate(opts.generatedAtIso)}   Priority: HIGH`;
  page.drawText(meta, {
    x: MARGIN_X,
    y,
    size: TYPE.small,
    font,
    color: COLORS.muted,
  });
  y -= 14;
  line(0.8);

  // ============== STUDENT INFO (CARD BLOCK) ==============
  ensureSpace(90);
  const studentCardTop = y;
  const items = [
    { label: "Student Name", value: safeText(opts.studentName) || "-" },
    {
      label: "Exam Focus",
      value: firstRow ? safeText(firstRow.teacherFeedbackExamTrack) || "-" : "-",
    },
    { label: "Teacher", value: firstRow ? safeText(firstRow.teacher) || "-" : "-" },
    { label: "Class", value: "-" },
    { label: "Subject", value: firstRow ? safeText(firstRow.subject) || "-" : "-" },
    { label: "Lead Source", value: "-" },
  ];
  const studentCardH = drawKeyValueGrid2(MARGIN_X, studentCardTop, BODY_W, items);
  y = studentCardTop - studentCardH - 12;

  // ============== OVERALL ASSESSMENT (SPLIT) ==============
  ensureSpace(50);
  const assessTop = y;
  const leftW = 155;
  const rightW = BODY_W - leftW;
  drawCard(MARGIN_X, assessTop, leftW, 44, COLORS.teal, COLORS.border);
  page.drawText("OVERALL ASSESSMENT", {
    x: MARGIN_X + 10,
    y: assessTop - 16,
    size: TYPE.small,
    font: fontBold,
    color: COLORS.white,
  });
  const level = safeText(opts.manualStudentLevel) || ratingLabel(firstRow?.teacherFeedbackRating);
  page.drawText(level.toUpperCase(), {
    x: MARGIN_X + 10,
    y: assessTop - 30,
    size: 12,
    font: fontBold,
    color: COLORS.white,
  });
  drawCard(MARGIN_X + leftW, assessTop, rightW, 44, COLORS.white, COLORS.border);
  {
    const ySave0 = y;
    y = assessTop - 22;
    drawParagraph(
      "Promising - small gaps to address",
      MARGIN_X + leftW + 10,
      rightW - 20,
      TYPE.body,
      true,
      COLORS.text,
      LEADING.body,
    );
    y = ySave0;
  }
  y = assessTop - 56;

  // optional assessment details (Attempted/Correct/Level)
  const attempted = safeText(opts.manualQuestionsAttempted);
  const correct = safeText(opts.manualCorrectAnswers);
  const hasAssessmentDetails =
    opts.reportSource === "teacher_feedback" && (!!attempted || !!correct || !!level);
  if (hasAssessmentDetails) {
    ensureSpace(18);
    const details = `Attempted: ${attempted || "-"}   Correct: ${correct || "-"}   Level: ${level || "-"}`;
    page.drawText(details, {
      x: MARGIN_X,
      y,
      size: TYPE.small,
      font,
      color: COLORS.muted,
    });
    y -= 16;
  }

  // ============== CLASS SUMMARY ==============
  drawSectionHeader("Class Summary", COLORS.sectionBlue);
  {
    const sumTop = y;
    const labelW = 110;
    const textMaxW = BODY_W - PAD * 2 - labelW;
    const topicsCovered = safeText(firstRow?.subject) || "-";
    const sessionPace = safeText(firstRow?.teacherFeedbackNotes) || "-";
    const h1 = measureParagraphH(topicsCovered, textMaxW, TYPE.small, false, LEADING.small);
    const h2 = measureParagraphH(sessionPace, textMaxW, TYPE.small, false, LEADING.small);
    const rowGap = 6;
    const contentH = h1 + h2 + rowGap + PAD * 2;
    const minH = 70;
    const sumH = Math.max(minH, contentH);
    ensureSpace(sumH + 14);
    drawCard(MARGIN_X, sumTop, BODY_W, sumH, COLORS.lightBg);

    // row 1
    page.drawText("TOPICS COVERED", {
      x: MARGIN_X + PAD,
      y: sumTop - PAD - 12,
      size: TYPE.small,
      font: fontBold,
      color: COLORS.muted,
    });
    const ySaveRow = y;
    y = sumTop - PAD - 12;
    drawParagraph(
      topicsCovered,
      MARGIN_X + PAD + labelW,
      textMaxW,
      TYPE.small,
      false,
      COLORS.text,
      LEADING.small,
    );
    const yAfter1 = y;
    y = sumTop - PAD - 12 - h1 - rowGap;

    // row 2
    page.drawText("SESSION PACE", {
      x: MARGIN_X + PAD,
      y: sumTop - PAD - 12 - h1 - rowGap,
      size: TYPE.small,
      font: fontBold,
      color: COLORS.muted,
    });
    drawParagraph(
      sessionPace,
      MARGIN_X + PAD + labelW,
      textMaxW,
      TYPE.small,
      false,
      COLORS.text,
      LEADING.small,
    );
    const yAfter2 = y;
    y = ySaveRow;
    y = Math.min(yAfter1, yAfter2) - 12;
  }

  // ============== PERFORMANCE SCORES (TABLE) ==============
  drawSectionHeader("Performance Scores", COLORS.sectionBlue);
  const base = scoreToLevel(firstRow?.teacherFeedbackRating);
  drawPerformanceTable([
    {
      parameter: "Interest & Participation",
      rating: Math.min(5, base + 1),
      scoreLabel: `${Math.min(5, base + 1)}/5`,
      interpretation: "Strong - performing well above average",
      tone: "good",
    },
    {
      parameter: "Understanding of Concepts",
      rating: base,
      scoreLabel: `${base}/5`,
      interpretation: "Adequate - needs baseline, room to grow",
      tone: base >= 4 ? "good" : "warn",
    },
    {
      parameter: "Solving Questions",
      rating: Math.max(1, base - 1),
      scoreLabel: `${Math.max(1, base - 1)}/5`,
      interpretation: "Adequate - needs practice, room to grow",
      tone: base >= 4 ? "good" : "warn",
    },
    {
      parameter: "Exam Habits & Discipline",
      rating: Math.min(5, base + 1),
      scoreLabel: `${Math.min(5, base + 1)}/5`,
      interpretation: "Strong - performing well above average",
      tone: "good",
    },
  ]);

  // ============== STRENGTHS vs AREAS (2 COLUMN CARDS) ==============
  ensureSpace(120);
  const twoTop = y;
  const colW = (BODY_W - GRID_GAP) / 2;
  const leftTop = twoTop;
  const rightTop = twoTop;

  // strengths
  page.drawRectangle({
    x: MARGIN_X,
    y: leftTop - 18,
    width: colW,
    height: 18,
    color: COLORS.green,
  });
  page.drawText("STRENGTHS", {
    x: MARGIN_X + 10,
    y: leftTop - 13,
    size: TYPE.body,
    font: fontBold,
    color: COLORS.white,
  });
  const strengthsText = safeText(firstRow?.teacherFeedbackStrengths) || "-";
  const strengthsH = measureParagraphH(
    strengthsText,
    colW - PAD * 2,
    TYPE.small,
    false,
    LEADING.small,
  );
  const blockH = Math.max(90, strengthsH + 26);
  drawCard(MARGIN_X, leftTop - 18, colW, blockH, COLORS.white);
  const ySave = y;
  y = leftTop - 34;
  drawParagraph(
    strengthsText,
    MARGIN_X + PAD,
    colW - PAD * 2,
    TYPE.small,
    false,
    COLORS.text,
    LEADING.small,
  );
  const yAfterStrength = y;
  y = ySave;

  // improve
  const xR = MARGIN_X + colW + GRID_GAP;
  page.drawRectangle({
    x: xR,
    y: rightTop - 18,
    width: colW,
    height: 18,
    color: COLORS.orange,
  });
  page.drawText("AREAS TO IMPROVE", {
    x: xR + 10,
    y: rightTop - 13,
    size: TYPE.body,
    font: fontBold,
    color: COLORS.white,
  });
  const improveText = safeText(firstRow?.teacherFeedbackImprovements) || "-";
  const improveH = measureParagraphH(
    improveText,
    colW - PAD * 2,
    TYPE.small,
    false,
    LEADING.small,
  );
  const blockHR = Math.max(90, improveH + 26);
  const blockMaxH = Math.max(blockH, blockHR);
  drawCard(xR, rightTop - 18, colW, blockMaxH, COLORS.white);
  const ySave2 = y;
  y = rightTop - 34;
  drawParagraph(
    improveText,
    xR + PAD,
    colW - PAD * 2,
    TYPE.small,
    false,
    COLORS.text,
    LEADING.small,
  );
  const yAfterImprove = y;
  y = ySave2;

  y = Math.min(yAfterStrength, yAfterImprove) - 12;

  // ============== PARENT STATUS + HOMEWORK (SIDE BY SIDE) ==============
  ensureSpace(90);
  const phTop = y;
  // dynamic heights based on text + list
  const parentX = MARGIN_X;
  const homeX = MARGIN_X + colW + GRID_GAP;
  page.drawRectangle({ x: parentX, y: phTop - 18, width: colW, height: 18, color: COLORS.orange });
  page.drawText("PARENT STATUS", {
    x: parentX + 10,
    y: phTop - 13,
    size: 9,
    font: fontBold,
    color: COLORS.white,
  });
  const parentText = "Partly - parent joined for the last 15 minutes";
  const parentBodyH = measureParagraphH(parentText, colW - PAD * 2, TYPE.small, false, LEADING.small);
  const hwTextRaw = safeText(firstRow?.teacherFeedbackRecommendedNext) || "-";
  const hwLines = hwTextRaw ? hwTextRaw.split(/\s*\n\s*/).filter(Boolean) : [];
  const maxItems = 3;
  const hwForMeasure = (hwLines.length ? hwLines : ["-"]).slice(0, maxItems);
  const hwBodyH = hwForMeasure.reduce((acc, t) => {
    const h = measureParagraphH(t, colW - PAD * 2 - 14, TYPE.small, false, LEADING.small) + 2;
    return acc + h;
  }, 0);
  const phH = Math.max(98, 26 + Math.max(parentBodyH, hwBodyH));

  drawCard(parentX, phTop - 18, colW, phH, COLORS.white);
  const ySave3 = y;
  y = phTop - 34;
  drawParagraph(parentText, parentX + PAD, colW - PAD * 2, TYPE.small, false, COLORS.text, LEADING.small);
  const parentAfter = y;
  y = ySave3;

  page.drawRectangle({ x: homeX, y: phTop - 18, width: colW, height: 18, color: COLORS.teal });
  page.drawText("HOMEWORK & NEXT STEPS", {
    x: homeX + 10,
    y: phTop - 13,
    size: 9,
    font: fontBold,
    color: COLORS.white,
  });
  drawCard(homeX, phTop - 18, colW, phH, COLORS.white);
  const ySave4 = y;
  y = phTop - 34;
  for (let i = 0; i < hwForMeasure.length; i++) {
    const t = hwForMeasure[i] || "-";
    page.drawText(`${i + 1}.`, {
      x: homeX + PAD,
      y,
      size: 9,
      font: fontBold,
      color: COLORS.text,
    });
    drawParagraph(
      t,
      homeX + PAD + 14,
      colW - PAD * 2 - 14,
      TYPE.small,
      false,
      COLORS.text,
      LEADING.small,
    );
    y -= 2;
  }
  const hwAfter = y;
  y = ySave4;
  y = Math.min(parentAfter, hwAfter) - 10;

  // ============== OFFICE ACTION PLAN ==============
  drawSectionHeader("Office Action Plan", COLORS.sectionBlue);
  const officeTop = y;
  const officeBody =
    "Call within 24 hours. Warm, encouraging tone - student is genuinely capable but parent needs more conviction.";
  const officeBodyH = measureParagraphH(officeBody, BODY_W - PAD * 2, TYPE.small, false, LEADING.small);
  const officeH = Math.max(74, 26 + officeBodyH + PAD);
  ensureSpace(officeH + 10);
  drawCard(MARGIN_X, officeTop, BODY_W, officeH, COLORS.white);
  page.drawRectangle({
    x: MARGIN_X,
    y: officeTop - 18,
    width: BODY_W,
    height: 18,
    color: rgb(0.98, 0.92, 0.86),
    borderWidth: 0.8,
    borderColor: COLORS.orange,
  });
  page.drawText("FOLLOW UP - Call within 24 hrs, warm encouraging tone", {
    x: MARGIN_X + 10,
    y: officeTop - 13,
    size: TYPE.small,
    font: fontBold,
    color: COLORS.orange,
  });
  const ySave5 = y;
  y = officeTop - 34;
  drawParagraph(officeBody, MARGIN_X + 10, BODY_W - 20, TYPE.small, false, COLORS.text, LEADING.small);
  y = Math.min(ySave5, y) - 10;

  // ============== INTERNAL NOTE ==============
  if (safeText(opts.additionalNotes)) {
    drawSectionHeader("Internal Note - Not Shared With Family", COLORS.purple);
    const noteTop = y;
    const noteText = safeText(opts.additionalNotes);
    const noteHText = measureParagraphH(noteText, BODY_W - PAD * 2, TYPE.small, false, LEADING.small);
    const noteH = Math.max(70, PAD + noteHText + PAD);
    ensureSpace(noteH + 10);
    drawCard(MARGIN_X, noteTop, BODY_W, noteH, COLORS.white, COLORS.purple);
    const ySave6 = y;
    y = noteTop - PAD - 2;
    drawParagraph(noteText, MARGIN_X + PAD, BODY_W - PAD * 2, TYPE.small, false, COLORS.purple, LEADING.small);
    y = Math.min(ySave6, y) - 8;
  }

  // ============== FOOTER ==============
  ensureSpace(40);
  line(0.8);
  const footerY = y;
  page.drawText("Generated by Institute CRM", {
    x: MARGIN_X,
    y: footerY,
    size: TYPE.small,
    font,
    color: COLORS.muted,
  });
  page.drawText(`Report ID: ${reportId}`, {
    x: MARGIN_X,
    y: footerY - 10,
    size: TYPE.small,
    font,
    color: COLORS.muted,
  });
  page.drawText(`Teacher: ${safeText(firstRow?.teacher) || "-"}`, {
    x: MARGIN_X + BODY_W - 170,
    y: footerY,
    size: TYPE.small,
    font,
    color: COLORS.muted,
  });
  page.drawText(`Date: ${fmtDate(opts.generatedAtIso)}`, {
    x: MARGIN_X + BODY_W - 170,
    y: footerY - 10,
    size: TYPE.small,
    font,
    color: COLORS.muted,
  });

  return pdf.save();
}
