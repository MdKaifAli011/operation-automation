import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";

function ratingLabel(v: string | undefined): string {
  if (!v?.trim()) return "—";
  const m: Record<string, string> = {
    excellent: "Excellent",
    good: "Good",
    satisfactory: "Satisfactory",
    needs_improvement: "Needs improvement",
  };
  return m[v] ?? v;
}

function wrapToWidth(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxW: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) <= maxW) {
        line = next;
      } else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(w, size) <= maxW) {
          line = w;
        } else {
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
      }
    }
    if (line) lines.push(line);
    if (words.length === 0) lines.push("");
  }
  return lines.length ? lines : [""];
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const BODY_W = PAGE_W - MARGIN * 2;

export async function buildStudentReportPdfBytes(opts: {
  studentName: string;
  demoRows: DemoTableRowPersisted[];
  additionalNotes: string;
  recommendations: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (need: number) => {
    if (y < MARGIN + need) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const emit = (text: string, size: number, bold: boolean) => {
    const f = bold ? fontBold : font;
    const lines = wrapToWidth(text, f, size, BODY_W);
    for (const ln of lines) {
      ensureSpace(size + 8);
      page.drawText(ln, {
        x: MARGIN,
        y,
        size,
        font: f,
        color: rgb(0.12, 0.12, 0.14),
      });
      y -= size + 4;
    }
  };

  emit("Student progress report", 14, true);
  emit(opts.studentName?.trim() || "Student", 11, true);
  y -= 8;

  emit("Demo teacher feedback", 11, true);

  const feedbackRows = opts.demoRows.filter((r) =>
    Boolean(r.teacherFeedbackSubmittedAt?.trim()),
  );

  if (feedbackRows.length === 0) {
    emit(
      "No submitted teacher feedback yet. Completed demo feedback forms will be included in this section automatically.",
      10,
      false,
    );
  } else {
    for (let i = 0; i < feedbackRows.length; i++) {
      const r = feedbackRows[i]!;
      emit(
        `Demo ${i + 1}: ${r.subject || "—"} · ${r.teacher || "—"} · ${r.isoDate || "—"}`,
        11,
        true,
      );
      emit(`Overall: ${ratingLabel(r.teacherFeedbackRating)}`, 10, false);
      if (r.teacherFeedbackExamTrack?.trim()) {
        emit(`Track / focus: ${r.teacherFeedbackExamTrack.trim()}`, 10, false);
      }
      if (r.teacherFeedbackStrengths?.trim()) {
        emit(`Strengths: ${r.teacherFeedbackStrengths.trim()}`, 10, false);
      }
      if (r.teacherFeedbackImprovements?.trim()) {
        emit(`Areas to improve: ${r.teacherFeedbackImprovements.trim()}`, 10, false);
      }
      if (r.teacherFeedbackNotes?.trim()) {
        emit(`Notes: ${r.teacherFeedbackNotes.trim()}`, 10, false);
      }
      if (r.teacherFeedbackRecommendedNext?.trim()) {
        emit(`Recommended next: ${r.teacherFeedbackRecommendedNext.trim()}`, 10, false);
      }
      y -= 6;
    }
  }

  y -= 6;
  emit("Additional notes (institute)", 11, true);
  emit(opts.additionalNotes.trim() || "—", 10, false);
  y -= 6;

  emit("Recommendations for parents / student", 11, true);
  emit(opts.recommendations.trim() || "—", 10, false);

  return pdf.save();
}
