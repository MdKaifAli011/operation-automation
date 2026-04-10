import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  brochureItemsFromDoc,
  escapeRegexLiteral,
  isValidBrochureKey,
  resolveCanonicalTargetExam,
} from "@/lib/examBrochureTemplates";
import { getActiveTargetExamValues } from "@/lib/serverTargetExams";
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

/** Resolve disk path for a stored URL under this exam (legacy flat or key/subfolder). */
function uploadsPathForUrl(publicUrl: string, exam: string): string | null {
  const prefix = `/uploads/exam-brochures/${exam}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (!rest || rest.includes("..")) return null;
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 1) {
    const f = parts[0]!;
    if (f.includes("\\")) return null;
    return path.join(
      process.cwd(),
      "public",
      "uploads",
      "exam-brochures",
      exam,
      f,
    );
  }
  if (parts.length === 2) {
    const [keySeg, fname] = parts;
    if (
      !keySeg ||
      !fname ||
      !/^[a-zA-Z0-9_-]+$/.test(keySeg) ||
      fname.includes("..") ||
      fname.includes("/") ||
      fname.includes("\\")
    ) {
      return null;
    }
    return path.join(
      process.cwd(),
      "public",
      "uploads",
      "exam-brochures",
      exam,
      keySeg,
      fname,
    );
  }
  return null;
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
    const decoded = decodeURIComponent(rawExam || "").trim();
    const allowedList = await getActiveTargetExamValues();
    const exam = decoded
      ? resolveCanonicalTargetExam(decoded, allowedList)
      : null;
    if (!exam) {
      return NextResponse.json({ error: "Invalid exam" }, { status: 400 });
    }

    const formData = await req.formData();
    const brochureKeyRaw = formData.get("brochureKey");
    const brochureKey =
      typeof brochureKeyRaw === "string" ? brochureKeyRaw.trim() : "";
    if (!brochureKey || !isValidBrochureKey(brochureKey)) {
      return NextResponse.json(
        { error: "Missing or invalid brochureKey" },
        { status: 400 },
      );
    }

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

    await connectDB();
    const existing = await ExamBrochureTemplateModel.findOne({
      exam: new RegExp(`^${escapeRegexLiteral(exam)}$`, "i"),
    }).lean();
    const brochures = brochureItemsFromDoc(existing);
    const idx = brochures.findIndex((b) => b.key === brochureKey);
    const prevUrl =
      idx >= 0 ? brochures[idx]!.storedFileUrl?.trim() || null : null;
    if (typeof prevUrl === "string" && prevUrl) {
      await removeStoredFile(prevUrl, exam);
    }

    const safeName = `${randomUUID()}${ext}`;
    const dir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "exam-brochures",
      exam,
      brochureKey,
    );
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buf);

    const storedFileUrl = `/uploads/exam-brochures/${exam}/${brochureKey}/${safeName}`;
    const storedFileName = (file.name && file.name.trim()) || safeName;

    let next = [...brochures];
    if (idx >= 0) {
      next[idx] = {
        ...next[idx]!,
        storedFileUrl,
        storedFileName,
      };
    } else {
      next.push({
        key: brochureKey,
        title: "",
        summary: "",
        linkUrl: "",
        linkLabel: "",
        storedFileUrl,
        storedFileName,
        sortOrder: next.length,
      });
    }
    next.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));

    const filter = existing?._id ? { _id: existing._id } : { exam };
    await ExamBrochureTemplateModel.findOneAndUpdate(
      filter,
      {
        $set: { exam, brochures: next },
        $unset: {
          title: "",
          summary: "",
          linkUrl: "",
          linkLabel: "",
          storedFileUrl: "",
          storedFileName: "",
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    return NextResponse.json({
      storedFileUrl,
      storedFileName,
      exam,
      brochureKey,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Ctx) {
  try {
    const { exam: rawExam } = await context.params;
    const decoded = decodeURIComponent(rawExam || "").trim();
    const allowedList = await getActiveTargetExamValues();
    const exam = decoded
      ? resolveCanonicalTargetExam(decoded, allowedList)
      : null;
    if (!exam) {
      return NextResponse.json({ error: "Invalid exam" }, { status: 400 });
    }

    const url = new URL(req.url);
    const brochureKey = (url.searchParams.get("brochureKey") ?? "").trim();
    if (!brochureKey || !isValidBrochureKey(brochureKey)) {
      return NextResponse.json(
        { error: "Query brochureKey is required" },
        { status: 400 },
      );
    }

    await connectDB();
    const existing = await ExamBrochureTemplateModel.findOne({
      exam: new RegExp(`^${escapeRegexLiteral(exam)}$`, "i"),
    }).lean();
    const brochures = brochureItemsFromDoc(existing);
    const idx = brochures.findIndex((b) => b.key === brochureKey);
    if (idx < 0) {
      return NextResponse.json({ ok: true });
    }
    const urlRm = brochures[idx]!.storedFileUrl?.trim() || null;
    if (typeof urlRm === "string" && urlRm) {
      await removeStoredFile(urlRm, exam);
    }
    const next = brochures.map((b, i) =>
      i === idx
        ? { ...b, storedFileUrl: null, storedFileName: null }
        : { ...b },
    );

    const filter = existing?._id ? { _id: existing._id } : { exam };
    await ExamBrochureTemplateModel.findOneAndUpdate(
      filter,
      {
        $set: { exam, brochures: next },
        $unset: {
          title: "",
          summary: "",
          linkUrl: "",
          linkLabel: "",
          storedFileUrl: "",
          storedFileName: "",
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not remove file" }, { status: 500 });
  }
}
