import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 34;
const MARGIN_BOTTOM = 32;
const BODY_W = PAGE_W - MARGIN_X * 2;

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

export async function buildStudentReportPdfBytes(opts: {
  studentName: string;
  demoRows: DemoTableRowPersisted[];
  additionalNotes: string;
  recommendations: string;
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

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN_BOTTOM) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 32;
    }
  };

  const drawWrapped = (
    text: string,
    x: number,
    width: number,
    size: number,
    bold = false,
    color = rgb(0.12, 0.14, 0.18),
  ) => {
    const f = bold ? fontBold : font;
    const lines = wrapToWidth(text, f, size, width);
    for (const ln of lines) {
      page.drawText(ln, { x, y, size, font: f, color });
      y -= size + 3;
    }
  };

  const drawSectionTitle = (title: string) => {
    ensureSpace(26);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 8,
      width: BODY_W,
      height: 20,
      color: rgb(0.95, 0.97, 1),
    });
    page.drawText(safeText(title), {
      x: MARGIN_X + 8,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.09, 0.2, 0.43),
    });
    y -= 22;
  };

  // Header
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 56,
    width: BODY_W,
    height: 56,
    color: rgb(0.09, 0.39, 0.72),
  });
  page.drawText("Demo Session Report", {
    x: MARGIN_X + 12,
    y: y - 18,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Prepared for: ${safeText(opts.studentName) || "Student"}`, {
    x: MARGIN_X + 12,
    y: y - 36,
    size: 10,
    font,
    color: rgb(0.94, 0.98, 1),
  });
  page.drawText(`Generated: ${fmtDate(opts.generatedAtIso)}`, {
    x: MARGIN_X + 12,
    y: y - 48,
    size: 9,
    font,
    color: rgb(0.94, 0.98, 1),
  });
  if (logoImage) {
    const maxW = 128;
    const maxH = 36;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    const boxX = MARGIN_X + BODY_W - w - 10;
    const boxY = y - 50;
    page.drawRectangle({
      x: boxX - 3,
      y: boxY - 3,
      width: w + 6,
      height: h + 6,
      color: rgb(1, 1, 1),
      borderWidth: 0.7,
      borderColor: rgb(0.78, 0.85, 0.93),
    });
    page.drawImage(logoImage, { x: boxX, y: boxY, width: w, height: h });
  }
  y -= 72;

  const feedbackRows = opts.demoRows.filter((r) =>
    Boolean(r.teacherFeedbackSubmittedAt?.trim()),
  );

  drawSectionTitle("Report summary");
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 36,
    width: BODY_W,
    height: 36,
    color: rgb(1, 1, 1),
    borderWidth: 0.7,
    borderColor: rgb(0.84, 0.87, 0.92),
  });
  page.drawText("Submitted feedback forms", {
    x: MARGIN_X + 8,
    y: y - 12,
    size: 9,
    font: fontBold,
    color: rgb(0.36, 0.4, 0.48),
  });
  page.drawText(String(feedbackRows.length), {
    x: MARGIN_X + 220,
    y: y - 12,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.2, 0.45),
  });
  page.drawText("Student", {
    x: MARGIN_X + 8,
    y: y - 27,
    size: 9,
    font: fontBold,
    color: rgb(0.36, 0.4, 0.48),
  });
  page.drawText(safeText(opts.studentName) || "Student", {
    x: MARGIN_X + 220,
    y: y - 27,
    size: 10,
    font,
    color: rgb(0.12, 0.14, 0.18),
  });
  y -= 48;

  drawSectionTitle("Teacher feedback details");

  if (feedbackRows.length === 0) {
    page.drawRectangle({
      x: MARGIN_X,
      y: y - 30,
      width: BODY_W,
      height: 30,
      color: rgb(0.995, 0.995, 0.995),
      borderWidth: 0.7,
      borderColor: rgb(0.88, 0.9, 0.93),
    });
    page.drawText(
      "No submitted teacher feedback yet. This section fills automatically after teacher responses.",
      {
        x: MARGIN_X + 8,
        y: y - 14,
        size: 9,
        font,
        color: rgb(0.44, 0.47, 0.52),
      },
    );
    y -= 42;
  } else {
    for (let i = 0; i < feedbackRows.length; i++) {
      const r = feedbackRows[i]!;
      ensureSpace(170);
      const top = y;
      page.drawRectangle({
        x: MARGIN_X,
        y: top - 18,
        width: BODY_W,
        height: 18,
        color: rgb(0.97, 0.98, 1),
      });
      page.drawText(
        `Demo ${i + 1} - ${safeText(r.subject) || "Subject"} | ${safeText(r.teacher) || "Teacher"} | ${fmtDate(r.isoDate)}`,
        {
          x: MARGIN_X + 8,
          y: top - 11,
          size: 9,
          font: fontBold,
          color: rgb(0.1, 0.2, 0.42),
        },
      );
      y = top - 28;

      const fields: Array<[string, string]> = [
        ["Overall rating", ratingLabel(r.teacherFeedbackRating)],
        ["Track / focus", safeText(r.teacherFeedbackExamTrack) || "Not provided"],
        ["Strengths", safeText(r.teacherFeedbackStrengths) || "Not provided"],
        [
          "Areas to improve",
          safeText(r.teacherFeedbackImprovements) || "Not provided",
        ],
        ["Notes", safeText(r.teacherFeedbackNotes) || "Not provided"],
        [
          "Recommended next",
          safeText(r.teacherFeedbackRecommendedNext) || "Not provided",
        ],
      ];

      for (const [label, value] of fields) {
        ensureSpace(18);
        page.drawText(`${label}:`, {
          x: MARGIN_X + 8,
          y,
          size: 9,
          font: fontBold,
          color: rgb(0.35, 0.4, 0.48),
        });
        const xVal = MARGIN_X + 138;
        const wVal = BODY_W - (xVal - MARGIN_X) - 8;
        const f = font;
        const lines = wrapToWidth(value, f, 9, wVal);
        for (const ln of lines) {
          page.drawText(ln, {
            x: xVal,
            y,
            size: 9,
            font: f,
            color: rgb(0.12, 0.14, 0.18),
          });
          y -= 12;
          ensureSpace(14);
        }
        y -= 2;
      }

      const blockHeight = top - y + 4;
      page.drawRectangle({
        x: MARGIN_X,
        y: top - blockHeight,
        width: BODY_W,
        height: blockHeight,
        borderWidth: 0.7,
        borderColor: rgb(0.84, 0.87, 0.92),
      });
      y -= 8;
    }
  }

  drawSectionTitle("Additional notes (institute)");
  ensureSpace(60);
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 46,
    width: BODY_W,
    height: 46,
    color: rgb(1, 1, 1),
    borderWidth: 0.7,
    borderColor: rgb(0.84, 0.87, 0.92),
  });
  y -= 12;
  drawWrapped(
    safeText(opts.additionalNotes) || "Not provided",
    MARGIN_X + 8,
    BODY_W - 16,
    9,
    false,
  );
  y -= 6;

  drawSectionTitle("Recommendations for parents / student");
  ensureSpace(70);
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 54,
    width: BODY_W,
    height: 54,
    color: rgb(1, 1, 1),
    borderWidth: 0.7,
    borderColor: rgb(0.84, 0.87, 0.92),
  });
  y -= 12;
  drawWrapped(
    safeText(opts.recommendations) || "Not provided",
    MARGIN_X + 8,
    BODY_W - 16,
    9,
    false,
  );

  return pdf.save();
}
