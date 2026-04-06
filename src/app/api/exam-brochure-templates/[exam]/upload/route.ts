import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { TARGET_EXAM_OPTIONS } from "@/lib/constants";
import connectDB from "@/lib/mongodb";
import ExamBrochureTemplateModel from "@/models/ExamBrochureTemplate";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/octet-stream",
]);

function uploadsPathForUrl(publicUrl: string, exam: string): string | null {
  const prefix = `/uploads/exam-brochures/${exam}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) {
    return null;
  }
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "exam-brochures",
    exam,
    rest,
  );
}

async function removeStoredFile(publicUrl: string, exam: string) {
  const full = uploadsPathForUrl(publicUrl, exam);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* gone */
  }
}

const SAFE_EXT = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
]);

type Ctx = { params: Promise<{ exam: string }> };

export async function POST(req: Request, context: Ctx) {
  try {
    const { exam: rawExam } = await context.params;
    const exam = decodeURIComponent(rawExam || "").trim();
    const allowed = new Set<string>([...TARGET_EXAM_OPTIONS]);
    if (!exam || !allowed.has(exam)) {
      return NextResponse.json({ error: "Invalid exam" }, { status: 400 });
    }

    await connectDB();
    const doc = await ExamBrochureTemplateModel.findOne({ exam }).lean();
    const oldUrl =
      doc && typeof (doc as { storedFileUrl?: string | null }).storedFileUrl === "string"
        ? (doc as { storedFileUrl?: string | null }).storedFileUrl
        : null;
    if (typeof oldUrl === "string" && oldUrl) {
      await removeStoredFile(oldUrl, exam);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 400 },
      );
    }

    const mime = file.type || "";
    const extProbe = path.extname(file.name || "").toLowerCase();
    if (
      mime &&
      !ALLOWED_MIME.has(mime) &&
      !(extProbe && SAFE_EXT.has(extProbe))
    ) {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Use PDF, images, Word, Excel, PowerPoint, or plain text.",
        },
        { status: 400 },
      );
    }

    let ext = path.extname(file.name || "").toLowerCase();
    if (!ext || !SAFE_EXT.has(ext)) {
      ext =
        mime === "application/pdf"
          ? ".pdf"
          : mime === "image/jpeg"
            ? ".jpg"
            : mime === "image/png"
              ? ".png"
              : mime === "image/webp"
                ? ".webp"
                : mime === "image/gif"
                  ? ".gif"
                  : mime === "application/msword"
                    ? ".doc"
                    : mime.includes("wordprocessingml")
                      ? ".docx"
                      : mime.includes("spreadsheetml")
                        ? ".xlsx"
                        : mime === "application/vnd.ms-excel"
                          ? ".xls"
                          : mime.includes("presentationml")
                            ? ".pptx"
                            : mime === "application/vnd.ms-powerpoint"
                              ? ".ppt"
                              : mime === "text/csv"
                                ? ".csv"
                                : mime === "text/plain"
                                  ? ".txt"
                                  : ".bin";
    }

    if (!SAFE_EXT.has(ext) && ext !== ".bin") {
      return NextResponse.json(
        { error: "Could not determine a safe file extension." },
        { status: 400 },
      );
    }
    if (ext === ".bin") {
      return NextResponse.json(
        { error: "Use a recognized document or image type." },
        { status: 400 },
      );
    }

    const safeName = `${randomUUID()}${ext}`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exam-brochures",
      exam,
    );
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buf);

    const storedFileUrl = `/uploads/exam-brochures/${exam}/${safeName}`;
    const storedFileName = (file.name && file.name.trim()) || safeName;

    await ExamBrochureTemplateModel.findOneAndUpdate(
      { exam },
      {
        $set: {
          exam,
          storedFileUrl,
          storedFileName,
        },
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({ storedFileUrl, storedFileName, exam });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Ctx) {
  try {
    const { exam: rawExam } = await context.params;
    const exam = decodeURIComponent(rawExam || "").trim();
    const allowed = new Set<string>([...TARGET_EXAM_OPTIONS]);
    if (!exam || !allowed.has(exam)) {
      return NextResponse.json({ error: "Invalid exam" }, { status: 400 });
    }

    await connectDB();
    const doc = await ExamBrochureTemplateModel.findOne({ exam }).lean();
    const url =
      doc && typeof (doc as { storedFileUrl?: string | null }).storedFileUrl === "string"
        ? (doc as { storedFileUrl?: string | null }).storedFileUrl
        : null;
    if (typeof url === "string" && url) {
      await removeStoredFile(url, exam);
    }

    await ExamBrochureTemplateModel.findOneAndUpdate(
      { exam },
      { $set: { storedFileUrl: null, storedFileName: null } },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not remove file" }, { status: 500 });
  }
}
