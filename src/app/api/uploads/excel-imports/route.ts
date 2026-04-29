import { NextRequest, NextResponse } from "next/server";
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
 * GET /api/uploads/excel-imports?date=YYYY-MM-DD
 * List uploaded files with optional date filter
 * Query params:
 *   - date: Filter files by date (YYYY-MM-DD format), defaults to today
 */
export async function GET(req: NextRequest) {
  try {
    // Get date parameter, default to today
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    
    // Parse filter date or use today
    const filterDate = dateParam 
      ? new Date(dateParam + "T00:00:00") 
      : new Date();
    
    const filterDateStr = filterDate.toISOString().split("T")[0]; // YYYY-MM-DD

    let files: UploadedFile[] = [];

    try {
      const entries = await readdir(UPLOAD_DIR);
      
      for (const fileName of entries) {
        const filePath = path.join(UPLOAD_DIR, fileName);
        
        try {
          const stats = await stat(filePath);
          
          if (stats.isFile()) {
            const uploadedAt = stats.mtime;
            const fileDateStr = uploadedAt.toISOString().split("T")[0];
            
            // Filter by date (only show files from the specified date)
            if (fileDateStr !== filterDateStr) {
              continue;
            }
            
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
              uploadedAt: uploadedAt.toISOString(),
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
      filterDate: filterDateStr,
    });

  } catch (error) {
    console.error("List uploads error:", error);
    return NextResponse.json(
      { error: "Failed to list uploaded files" },
      { status: 500 }
    );
  }
}
