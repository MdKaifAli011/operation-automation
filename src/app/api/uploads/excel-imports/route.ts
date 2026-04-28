import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "excel-imports");

export type UploadedFile = {
  fileName: string;
  originalName: string | null;
  size: number;
  uploadedAt: string;
  fileUrl: string;
};

/**
 * GET /api/uploads/excel-imports
 * List all uploaded Excel files with metadata
 */
export async function GET() {
  try {
    let files: UploadedFile[] = [];

    try {
      const entries = await readdir(UPLOAD_DIR);
      
      for (const fileName of entries) {
        const filePath = path.join(UPLOAD_DIR, fileName);
        
        try {
          const stats = await stat(filePath);
          
          if (stats.isFile()) {
            // Parse timestamp and original name from filename format: {timestamp}_{random}_{originalName}
            const parts = fileName.split("_");
            let originalName = null;
            
            if (parts.length >= 3) {
              // Remove first two parts (timestamp and random string), rest is original name
              originalName = parts.slice(2).join("_");
            }

            files.push({
              fileName,
              originalName,
              size: stats.size,
              uploadedAt: stats.mtime.toISOString(),
              fileUrl: `/uploads/excel-imports/${fileName}`,
            });
          }
        } catch {
          // Skip files that can't be stat'd
        }
      }
    } catch {
      // Directory doesn't exist yet, return empty array
    }

    // Sort by upload date (newest first)
    files.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    return NextResponse.json({
      success: true,
      files,
      count: files.length,
    });

  } catch (error) {
    console.error("List uploads error:", error);
    return NextResponse.json(
      { error: "Failed to list uploaded files" },
      { status: 500 }
    );
  }
}
