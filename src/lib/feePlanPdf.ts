import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type InstallmentLine = {
  no: number;
  amountInr: number;
  dueDate: string;
};

type FeeOptionRow = {
  no: number;
  description: string;
  gstText: string;
  totalUsdText: string;
  dueDateText: string;
};

function fmtInr(v: number): string {
  const n = Math.max(0, Math.round(Number(v) || 0));
  return `INR ${new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(n)}`;
}

function fmtDate(iso: string): string {
  const t = String(iso ?? "").trim();
  if (!t) return "—";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function safeText(input: string): string {
  const s = String(input ?? "");
  return s
    .replace(/₹/g, "INR ")
    .replace(/[—–]/g, "-")
    .replace(/[\u0100-\uFFFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fitText(input: string, maxChars: number): string {
  const s = safeText(input);
  if (s.length <= maxChars) return s;
  if (maxChars <= 3) return s.slice(0, maxChars);
  return `${s.slice(0, maxChars - 3)}...`;
}

export async function buildFeePlanPdfBytes(input: {
  studentName: string;
  targetExam: string;
  courseName: string;
  currency: string;
  scholarshipPct: number;
  baseTotal: number;
  scholarshipAmount: number;
  finalFee: number;
  dueDate: string | null;
  installments: InstallmentLine[];
  generatedAtIso: string;
  option1Rows: FeeOptionRow[];
  option2Rows: FeeOptionRow[];
  option3Rows: FeeOptionRow[];
  logoPngBytes?: Uint8Array | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoImage = input.logoPngBytes?.length
    ? await pdf.embedPng(input.logoPngBytes)
    : null;

  const left = 42;
  const right = 553;
  const contentWidth = right - left;
  const pageW = 595;
  const pageH = 842;
  const bottomMargin = 42;
  let y = 0;

  const ensureSpace = (need: number) => {
    if (y - need < bottomMargin) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - 54;
    }
  };

  const drawOptionTable = (title: string, rows: FeeOptionRow[]) => {
    ensureSpace(40);
    page.drawText(safeText(title), {
      x: left,
      y,
      size: 11,
      font: bold,
      color: rgb(0.08, 0.12, 0.2),
    });
    // Keep a clear visual gap between option heading and table.
    y -= 24;
    ensureSpace(24);
    page.drawRectangle({
      x: left,
      y: y - 5,
      width: contentWidth,
      height: 20,
      color: rgb(0.95, 0.97, 1),
    });
    page.drawText("No.", {
      x: left + 6,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.3, 0.35),
    });
    page.drawText("Fee Description", {
      x: left + 36,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.3, 0.35),
    });
    page.drawText("GST (Tax)", {
      x: left + 266,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.3, 0.35),
    });
    page.drawText("Total Amount (USD)", {
      x: left + 336,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.3, 0.35),
    });
    const dueHead = "Due Date";
    const dueHeadW = bold.widthOfTextAtSize(dueHead, 8);
    page.drawText("Due Date", {
      x: right - 8 - dueHeadW,
      y,
      size: 8,
      font: bold,
      color: rgb(0.25, 0.3, 0.35),
    });
    y -= 20;

    for (const row of rows) {
      ensureSpace(20);
      page.drawRectangle({
        x: left,
        y: y - 4,
        width: contentWidth,
        height: 18,
        color: row.no % 2 === 0 ? rgb(0.992, 0.995, 1) : rgb(1, 1, 1),
        borderWidth: 0.4,
        borderColor: rgb(0.87, 0.89, 0.92),
      });
      page.drawText(String(row.no), {
        x: left + 8,
        y,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.14, 0.17),
      });
      page.drawText(fitText(row.description, 46), {
        x: left + 36,
        y,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.14, 0.17),
      });
      page.drawText(safeText(row.gstText), {
        x: left + 266,
        y,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.14, 0.17),
      });
      page.drawText(safeText(row.totalUsdText), {
        x: left + 336,
        y,
        size: 8,
        font: bold,
        color: rgb(0.06, 0.16, 0.34),
      });
      const dueText = fitText(row.dueDateText, 18);
      const dueTextW = regular.widthOfTextAtSize(dueText, 8);
      page.drawText(dueText, {
        x: right - 8 - dueTextW,
        y,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.14, 0.17),
      });
      y -= 18;
    }
    y -= 8;
  };

  page.drawRectangle({
    x: left,
    y: 764,
    width: contentWidth,
    height: 56,
    color: rgb(0.08, 0.4, 0.75),
  });
  page.drawText("Fee Plan", {
    x: left + 14,
    y: 798,
    size: 16,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(`Prepared for: ${safeText(input.studentName || "Student")}`, {
    x: left + 14,
    y: 778,
    size: 10,
    font: regular,
    color: rgb(0.95, 0.98, 1),
  });
  page.drawText(`Generated: ${fmtDate(input.generatedAtIso)}`, {
    x: left + 14,
    y: 766,
    size: 10,
    font: regular,
    color: rgb(0.95, 0.98, 1),
  });
  if (logoImage) {
    const maxW = 132;
    const maxH = 38;
    const scale = Math.min(maxW / logoImage.width, maxH / logoImage.height);
    const w = logoImage.width * scale;
    const h = logoImage.height * scale;
    const boxX = right - w - 8;
    const boxY = 774;
    page.drawRectangle({
      x: boxX - 4,
      y: boxY - 4,
      width: w + 8,
      height: h + 8,
      color: rgb(1, 1, 1),
      borderWidth: 0.8,
      borderColor: rgb(0.78, 0.85, 0.93),
    });
    page.drawImage(logoImage, { x: boxX, y: boxY, width: w, height: h });
  }

  const metaTop = 724;
  const metaRows: Array<[string, string]> = [
    ["Target exam", input.targetExam || "-"],
    ["Course", input.courseName || "-"],
    ["Student currency", input.currency || "INR"],
    ["Scholarship %", String(Math.max(0, Math.round(input.scholarshipPct)))],
    ["Total fee (INR)", fmtInr(input.baseTotal)],
    ["Amount of scholarship (INR)", fmtInr(input.scholarshipAmount)],
    ["After scholarship total (INR)", fmtInr(input.finalFee)],
  ];

  let rowY = metaTop;
  for (const [k, v] of metaRows) {
    page.drawRectangle({
      x: left,
      y: rowY - 4,
      width: contentWidth,
      height: 16,
      color: rowY % 2 === 0 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1),
    });
    page.drawText(k, {
      x: left + 4,
      y: rowY,
      size: 9,
      font: bold,
      color: rgb(0.35, 0.4, 0.45),
    });
    page.drawText(safeText(v), {
      x: left + 192,
      y: rowY,
      size: 10,
      font: regular,
      color: rgb(0.11, 0.13, 0.15),
    });
    rowY -= 18;
  }

  const tableTop = rowY - 12;
  page.drawText("Payment schedule", {
    x: left,
    y: tableTop + 14,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.12, 0.2),
  });
  page.drawRectangle({
    x: left,
    y: tableTop - 12,
    width: contentWidth,
    height: 24,
    color: rgb(0.94, 0.96, 0.98),
  });
  page.drawText("#", { x: left + 8, y: tableTop - 4, size: 9, font: bold, color: rgb(0.23, 0.25, 0.3) });
  page.drawText("Amount (INR)", { x: left + 58, y: tableTop - 4, size: 9, font: bold, color: rgb(0.23, 0.25, 0.3) });
  page.drawText("Due date", { x: left + 300, y: tableTop - 4, size: 9, font: bold, color: rgb(0.23, 0.25, 0.3) });

  const lines =
    input.installments.length > 0
      ? input.installments
      : [{ no: 1, amountInr: input.finalFee, dueDate: input.dueDate || "" }];

  y = tableTop - 34;
  for (const ln of lines) {
    page.drawRectangle({
      x: left,
      y: y - 6,
      width: contentWidth,
      height: 22,
      color: ln.no % 2 === 0 ? rgb(0.99, 0.99, 1) : rgb(1, 1, 1),
      borderWidth: 0.5,
      borderColor: rgb(0.87, 0.89, 0.92),
    });
    page.drawText(String(ln.no), {
      x: left + 8,
      y,
      size: 10,
      font: regular,
      color: rgb(0.1, 0.12, 0.15),
    });
    page.drawText(fmtInr(ln.amountInr), {
      x: left + 58,
      y,
      size: 10,
      font: bold,
      color: rgb(0.05, 0.15, 0.35),
    });
    page.drawText(fmtDate(ln.dueDate), {
      x: left + 300,
      y,
      size: 10,
      font: regular,
      color: rgb(0.1, 0.12, 0.15),
    });
    y -= 24;
  }

  page.drawRectangle({
    x: left,
    y: y - 6,
    width: contentWidth,
    height: 26,
    color: rgb(0.93, 0.97, 0.94),
    borderWidth: 0.8,
    borderColor: rgb(0.65, 0.8, 0.68),
  });
  page.drawText("Net payable", {
    x: left + 8,
    y: y + 3,
    size: 10,
    font: bold,
    color: rgb(0.11, 0.33, 0.16),
  });
  page.drawText(fmtInr(input.finalFee), {
    x: right - 120,
    y: y + 3,
    size: 11,
    font: bold,
    color: rgb(0.11, 0.33, 0.16),
  });

  page.drawText("This fee plan is generated by Gray Matter Consultancy Services for student/parent communication.", {
    x: left,
    y: 56,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.48, 0.52),
  });

  y = y - 22;
  if (y < 280) {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - 54;
  }
  drawOptionTable("Option 1 - Pay in USD (No GST)", input.option1Rows);
  drawOptionTable("Option 2 - Indian NRE (No GST)", input.option2Rows);
  drawOptionTable("Option 3 - Indian NRO (GST)", input.option3Rows);

  return pdf.save();
}
