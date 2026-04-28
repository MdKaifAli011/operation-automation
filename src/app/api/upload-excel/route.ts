import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

// File upload directory
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "excel-imports");

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed Excel MIME types
const ALLOWED_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream", // Some Excel files may have this
  "text/csv",
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [".xls", ".xlsx", ".csv"];

/**
 * POST /api/upload-excel
 * Upload an Excel file and save it to the server
 *
 * Public endpoint - no authentication required
 *
 * Request:
 *   Content-Type: multipart/form-data
 *   Body: { file: File }
 *
 * Response:
 *   { success: true, fileUrl: string, fileName: string, size: number }
 */
export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Send file in 'file' field." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Only Excel files (.xls, .xlsx, .csv) are allowed.` },
        { status: 400 }
      );
    }

    // Validate file extension
    const originalName = file.name;
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Invalid file extension: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeName = originalName
      .replace(/[^a-zA-Z0-9.-]/g, "_") // Replace special chars with underscore
      .replace(/_{2,}/g, "_"); // Collapse multiple underscores
    const fileName = `${timestamp}_${randomStr}_${safeName}`;

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Full file path
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Write file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Generate public URL (via /uploads rewrite)
    const fileUrl = `/uploads/excel-imports/${fileName}`;

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName,
      originalName,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error("Excel upload error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload-excel
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    description: "Upload Excel files to the server",
    authentication: {
      public: "No authentication required - fully public endpoint",
    },
    request: {
      method: "POST",
      contentType: "multipart/form-data",
      body: {
        file: "File - Excel file (.xls, .xlsx, .csv), max 10MB",
      },
    },
    response: {
      success: "boolean",
      fileUrl: "string - Public URL to access the file",
      fileName: "string - Generated unique filename",
      originalName: "string - Original filename",
      size: "number - File size in bytes",
      uploadedAt: "string - ISO timestamp",
    },
    example: {
      curl: `curl -X POST \\\n  -F "file=@data.xlsx" \\\n  http://your-domain.com/api/upload-excel`,
    },
  });
}
