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

  // Design System - Color Palette
  const colors = {
    // Primary brand colors
    primary: rgb(0.094, 0.369, 0.69), // Professional blue #1860B0
    primaryDark: rgb(0.047, 0.267, 0.549), // Darker blue #0C448C
    primaryLight: rgb(0.906, 0.941, 0.969), // Light blue background #E7F0F7
    
    // Accent colors
    accent: rgb(0.027, 0.604, 0.604), // Teal #079A9A
    success: rgb(0.133, 0.545, 0.133), // Green #228B22
    warning: rgb(0.855, 0.647, 0.125), // Gold #DAA520
    
    // Neutral colors
    darkText: rgb(0.125, 0.145, 0.169), // #202535
    mediumText: rgb(0.337, 0.396, 0.463), // #566576
    lightText: rgb(0.533, 0.596, 0.663), // #8898A9
    
    // Background colors
    bgPrimary: rgb(1, 1, 1),
    bgSecondary: rgb(0.98, 0.988, 0.996), // #FAFCFE
    bgTableHeader: rgb(0.094, 0.369, 0.69), // Match primary
    bgTableRowEven: rgb(0.976, 0.988, 0.996), // #F9FCFE
    bgTableRowOdd: rgb(1, 1, 1),
    bgHighlight: rgb(0.945, 0.973, 0.996), // #F1F8FE
    
    // Border colors
    borderLight: rgb(0.863, 0.902, 0.933), // #DCE6EE
    borderMedium: rgb(0.722, 0.784, 0.843), // #B8C8D7
    borderDark: rgb(0.094, 0.369, 0.69), // Match primary
  };

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

  const drawOptionTable = (title: string, rows: FeeOptionRow[], optionNum: number) => {
    ensureSpace(100);
    
    // Option badge and title
    const badgeColors = [
      { bg: rgb(0.204, 0.596, 0.859), border: rgb(0.114, 0.506, 0.769) }, // Blue
      { bg: rgb(0.235, 0.702, 0.443), border: rgb(0.145, 0.612, 0.353) }, // Green
      { bg: rgb(0.573, 0.439, 0.859), border: rgb(0.483, 0.349, 0.769) }, // Purple
    ];
    
    const badgeColor = badgeColors[optionNum - 1] || badgeColors[0];
    
    // Badge
    page.drawRectangle({
      x: left,
      y: y - 18,
      width: 75,
      height: 22,
      color: badgeColor.bg,
    });
    
    const optionText = `OPTION ${optionNum}`;
    const optionTextWidth = bold.widthOfTextAtSize(optionText, 9);
    page.drawText(optionText, {
      x: left + (75 - optionTextWidth) / 2,
      y: y - 12,
      size: 9,
      font: bold,
      color: rgb(1, 1, 1),
    });
    
    // Title
    page.drawText(safeText(title.replace(/^Option \d+ - /, "")), {
      x: left + 85,
      y: y - 12,
      size: 11,
      font: bold,
      color: colors.darkText,
    });
    
    y -= 36;
    ensureSpace(50);
    
    // Table header
    page.drawRectangle({
      x: left,
      y: y - 20,
      width: contentWidth,
      height: 24,
      color: colors.bgTableHeader,
    });
    
    // Column headers with better spacing
    const headers = [
      { text: "#", x: left + 15, align: "center" },
      { text: "Description", x: left + 50, align: "left" },
      { text: "GST", x: left + 295, align: "right" },
      { text: "Amount (USD)", x: left + 395, align: "right" },
      { text: "Due Date", x: right - 10, align: "right" },
    ];
    
    headers.forEach(header => {
      const textWidth = bold.widthOfTextAtSize(header.text, 9);
      let xPos = header.x;
      if (header.align === "center") xPos = header.x - textWidth / 2;
      if (header.align === "right") xPos = header.x - textWidth;
      
      page.drawText(header.text, {
        x: xPos,
        y: y - 11,
        size: 9,
        font: bold,
        color: rgb(1, 1, 1),
      });
    });
    
    y -= 24;
    
    // Table rows
    for (const row of rows) {
      ensureSpace(26);
      
      // Alternating row colors with subtle hover effect
      const rowColor = row.no % 2 === 0 ? colors.bgTableRowEven : colors.bgTableRowOdd;
      
      page.drawRectangle({
        x: left,
        y: y - 22,
        width: contentWidth,
        height: 24,
        color: rowColor,
        borderWidth: 0.5,
        borderColor: colors.borderLight,
      });
      
      // Row number (centered)
      const noText = String(row.no);
      const noTextWidth = regular.widthOfTextAtSize(noText, 9);
      page.drawText(noText, {
        x: left + 15 - noTextWidth / 2,
        y: y - 12,
        size: 9,
        font: regular,
        color: colors.mediumText,
      });
      
      // Description
      page.drawText(fitText(row.description, 52), {
        x: left + 50,
        y: y - 12,
        size: 9,
        font: regular,
        color: colors.darkText,
      });
      
      // GST (right-aligned)
      const gstText = safeText(row.gstText);
      const gstTextWidth = regular.widthOfTextAtSize(gstText, 9);
      page.drawText(gstText, {
        x: left + 295 - gstTextWidth,
        y: y - 12,
        size: 9,
        font: regular,
        color: colors.mediumText,
      });
      
      // Total amount (right-aligned, bold)
      const totalText = safeText(row.totalUsdText);
      const totalTextWidth = bold.widthOfTextAtSize(totalText, 9);
      page.drawText(totalText, {
        x: left + 395 - totalTextWidth,
        y: y - 12,
        size: 9,
        font: bold,
        color: colors.primary,
      });
      
      // Due date (right-aligned)
      const dueText = fitText(row.dueDateText, 20);
      const dueTextWidth = regular.widthOfTextAtSize(dueText, 9);
      page.drawText(dueText, {
        x: right - 10 - dueTextWidth,
        y: y - 12,
        size: 9,
        font: regular,
        color: colors.darkText,
      });
      
      y -= 24;
    }
    
    y -= 20;
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
  const hasScholarship = input.scholarshipPct > 0;
  const metaRows: Array<[string, string]> = [
    ["Target exam", input.targetExam || "-"],
    ["Course", input.courseName || "-"],
    ["Student currency", input.currency || "INR"],
    ["Total fee (INR)", fmtInr(input.baseTotal)],
  ];
  if (hasScholarship) {
    metaRows.push(["Scholarship %", String(Math.max(0, Math.round(input.scholarshipPct)))]);
    metaRows.push(["Amount of scholarship (INR)", fmtInr(input.scholarshipAmount)]);
    metaRows.push(["After scholarship total (INR)", fmtInr(input.finalFee)]);
  } else {
    metaRows.push(["Net payable (INR)", fmtInr(input.finalFee)]);
  }

  let rowY = metaTop;
  for (const [k, v] of metaRows) {
    page.drawRectangle({
      x: left,
      y: rowY - 4,
      width: contentWidth,
      height: 22,
      color: rowY % 2 === 0 ? rgb(0.985, 0.988, 0.995) : rgb(1, 1, 1),
      borderWidth: 0.5,
      borderColor: rgb(0.87, 0.89, 0.92),
    });
    page.drawText(k, {
      x: left + 6,
      y: rowY + 3,
      size: 11,
      font: bold,
      color: rgb(0.35, 0.4, 0.45),
    });
    page.drawText(safeText(v), {
      x: left + 192,
      y: rowY + 3,
      size: 11,
      font: regular,
      color: rgb(0.11, 0.13, 0.15),
    });
    rowY -= 22;
  }

  const tableTop = rowY - 40;
  page.drawText("Payment schedule", {
    x: left,
    y: tableTop + 30,
    size: 12,
    font: bold,
    color: rgb(0.1, 0.12, 0.2),
  });
  page.drawRectangle({
    x: left,
    y: tableTop - 12,
    width: contentWidth,
    height: 26,
    color: rgb(0.94, 0.96, 0.98),
    borderWidth: 0.5,
    borderColor: rgb(0.87, 0.89, 0.92),
  });
  // Center the # column
  const hashHead = "#";
  const hashHeadW = bold.widthOfTextAtSize(hashHead, 10);
  page.drawText(hashHead, { x: left + 30 - hashHeadW / 2, y: tableTop - 2, size: 10, font: bold, color: rgb(0.23, 0.25, 0.3) });
  page.drawText("Amount (INR)", { x: left + 70, y: tableTop - 2, size: 10, font: bold, color: rgb(0.23, 0.25, 0.3) });
  // Right-align Due date column
  const dueHead = "Due date";
  const dueHeadW = bold.widthOfTextAtSize(dueHead, 10);
  page.drawText(dueHead, { x: right - 8 - dueHeadW, y: tableTop - 2, size: 10, font: bold, color: rgb(0.23, 0.25, 0.3) });

  const lines =
    input.installments.length > 0
      ? input.installments
      : [{ no: 1, amountInr: input.finalFee, dueDate: input.dueDate || "" }];

  y = tableTop - 36;
  for (const ln of lines) {
    page.drawRectangle({
      x: left,
      y: y - 6,
      width: contentWidth,
      height: 24,
      color: ln.no % 2 === 0 ? rgb(0.99, 0.99, 1) : rgb(1, 1, 1),
      borderWidth: 0.5,
      borderColor: rgb(0.87, 0.89, 0.92),
    });
    // Center the # column
    const noText = String(ln.no);
    const noTextW = regular.widthOfTextAtSize(noText, 11);
    page.drawText(noText, {
      x: left + 30 - noTextW / 2,
      y,
      size: 11,
      font: regular,
      color: rgb(0.1, 0.12, 0.15),
    });
    page.drawText(fmtInr(ln.amountInr), {
      x: left + 70,
      y,
      size: 11,
      font: bold,
      color: rgb(0.05, 0.15, 0.35),
    });
    // Right-align Due date column
    const dueText = fmtDate(ln.dueDate);
    const dueTextW = regular.widthOfTextAtSize(dueText, 11);
    page.drawText(dueText, {
      x: right - 8 - dueTextW,
      y,
      size: 11,
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

  page.drawText("This fee plan is generated by Testprepkart for student/parent communication.", {
    x: left,
    y: 56,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.48, 0.52),
  });

  y = y - 30;
  if (y < 280) {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - 54;
  }
  drawOptionTable("Option 1 - Pay in USD (No GST)", input.option1Rows, 1);
  drawOptionTable("Option 2 - Indian NRE (No GST)", input.option2Rows, 2);
  drawOptionTable("Option 3 - Indian NRO (GST)", input.option3Rows, 3);

  return pdf.save();
}
