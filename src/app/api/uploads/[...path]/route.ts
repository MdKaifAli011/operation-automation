import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".csv": "text/csv",
};

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Serves files from `public/uploads/**` so brochure previews and direct links
 * work reliably (same behavior in dev and production).
 */
export async function GET(_req: Request, context: Ctx) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const full = path.resolve(UPLOADS_ROOT, ...segments);
  const rel = path.relative(UPLOADS_ROOT, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const st = await stat(full);
    if (!st.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const stream = createReadStream(full);
  const web = Readable.toWeb(stream);

  return new NextResponse(web as unknown as BodyInit, {
    headers: {
      "Content-Type": contentType(full),
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    },
  });
}
