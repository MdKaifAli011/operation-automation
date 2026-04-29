import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "excel-imports");

function isSafeFileName(fileName: string): boolean {
  if (!fileName) return false;
  if (fileName.includes("/") || fileName.includes("\\")) return false;
  if (fileName.includes("..")) return false;
  return true;
}

/**
 * DELETE /api/uploads/excel-imports/delete
 * Body: { fileName: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { fileName?: string }
      | null;
    const fileName = body?.fileName?.trim() ?? "";

    if (!isSafeFileName(fileName)) {
      return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
    }

    const filePath = path.join(UPLOAD_DIR, fileName);
    await unlink(filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete upload error:", error);
    return NextResponse.json(
      { error: "Failed to delete uploaded file" },
      { status: 500 },
    );
  }
}
