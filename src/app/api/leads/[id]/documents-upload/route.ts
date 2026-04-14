import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }
    await connectDB();
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 20 MB)." },
        { status: 400 },
      );
    }
    const mime = (file.type || "").trim();
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Use PDF, DOC, DOCX, XLS, XLSX, TXT, JPG, PNG, WebP, or GIF." },
        { status: 400 },
      );
    }

    let ext = path.extname(file.name || "");
    if (!ext || !/^\.[a-z0-9]+$/i.test(ext)) {
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
                    : mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      ? ".docx"
                      : mime === "application/vnd.ms-excel"
                        ? ".xls"
                        : mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          ? ".xlsx"
                          : mime === "text/plain"
                            ? ".txt"
                            : ".bin";
    }

    const safeName = `${randomUUID()}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "lead-documents", id);
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buf);

    const storedFileUrl = `/uploads/lead-documents/${id}/${safeName}`;
    const fileName = (file.name && file.name.trim()) || safeName;
    return NextResponse.json({ storedFileUrl, fileName });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
