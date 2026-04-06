import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function uploadsPathForUrl(publicUrl: string, leadId: string): string | null {
  const prefix = `/uploads/brochures/${leadId}/`;
  if (!publicUrl.startsWith(prefix)) return null;
  const rest = publicUrl.slice(prefix.length);
  if (!rest || rest.includes("..") || rest.includes("/") || rest.includes("\\")) {
    return null;
  }
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "brochures",
    leadId,
    rest,
  );
}

async function removeStoredFile(publicUrl: string, leadId: string) {
  const full = uploadsPathForUrl(publicUrl, leadId);
  if (!full) return;
  try {
    await unlink(full);
  } catch {
    /* already gone */
  }
}

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
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 12 MB)" },
        { status: 400 },
      );
    }
    const mime = file.type || "";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Use PDF, JPG, PNG, WebP, or GIF" },
        { status: 400 },
      );
    }

    const meta = lead.pipelineMeta as
      | { brochure?: { storedFileUrl?: string | null } }
      | undefined;
    const oldUrl = meta?.brochure?.storedFileUrl;
    if (typeof oldUrl === "string" && oldUrl) {
      await removeStoredFile(oldUrl, id);
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
                  : ".bin";
    }
    const safeName = `${randomUUID()}${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "brochures", id);
    await mkdir(dir, { recursive: true });
    const fullPath = path.join(dir, safeName);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(fullPath, buf);

    const storedFileUrl = `/uploads/brochures/${id}/${safeName}`;
    const fileName = (file.name && file.name.trim()) || safeName;

    return NextResponse.json({ storedFileUrl, fileName });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/** Removes the file on disk for this lead’s `pipelineMeta.brochure.storedFileUrl`. */
export async function DELETE(_req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
    }
    await connectDB();
    const lead = await LeadModel.findById(id).lean();
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const meta = lead.pipelineMeta as
      | { brochure?: { storedFileUrl?: string | null } }
      | undefined;
    const url = meta?.brochure?.storedFileUrl;
    if (typeof url === "string" && url) {
      await removeStoredFile(url, id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not remove file" }, { status: 500 });
  }
}
