import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import Lead from "@/models/Lead";
import { mergePipelineMeta } from "@/lib/pipeline";

export const runtime = "nodejs";

// Authentication check
function authorize(req: NextRequest): boolean {
  const authToken = req.cookies.get("auth-token")?.value;
  if (!authToken) return false;

  try {
    const decoded = Buffer.from(authToken, 'base64').toString('utf-8');
    const [userId, timestamp] = decoded.split(':');
    
    // Check if token is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return false;
    }
    
    return !!userId && !!timestamp;
  } catch {
    return false;
  }
}

// Also allow API key authentication for external apps
function authorizeApiKey(req: NextRequest): boolean {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const expectedKey = process.env.LEAD_IMPORT_API_KEY?.trim();
  
  if (!expectedKey) {
    // If no API key is configured, fall back to session auth
    return false;
  }
  
  return apiKey === expectedKey;
}

/**
 * POST /api/leads/import
 * Import a lead from external application
 * 
 * Authentication: Either session cookie (auth-token) or API key (x-api-key header)
 * 
 * Request body example:
 * {
 *   "studentName": "John Doe",
 *   "parentName": "Jane Doe",
 *   "phone": "+919876543210",
 *   "email": "john@example.com",
 *   "parentEmail": "parent@example.com",
 *   "grade": "12th",
 *   "targetExams": ["NEET", "JEE"],
 *   "country": "India",
 *   "dataType": "Organic",
 *   "sheetTab": "ongoing",
 *   "rowTone": "new",
 *   "followUpDate": "2024-12-31",
 *   "pipelineMeta": { ... },
 *   "activityLog": [ ... ],
 *   "workspaceNotes": "Initial notes",
 *   "callHistory": [ ... ]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const isSessionAuth = authorize(req);
    const isApiKeyAuth = authorizeApiKey(req);
    
    if (!isSessionAuth && !isApiKeyAuth) {
      return NextResponse.json(
        { error: "Unauthorized. Provide valid auth-token cookie or x-api-key header." },
        { status: 401 }
      );
    }

    // Connect to database
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    const body = await req.json();

    // Validate required fields
    if (!body.studentName) {
      return NextResponse.json(
        { error: "studentName is required" },
        { status: 400 }
      );
    }

    // Prepare lead data with defaults
    const leadData: Record<string, unknown> = {
      studentName: body.studentName?.trim() || "Add Student Name",
      parentName: body.parentName?.trim() || "",
      phone: body.phone?.trim() || "",
      email: body.email?.trim() || "",
      parentEmail: body.parentEmail?.trim() || "",
      grade: body.grade?.trim() || "12th",
      targetExams: Array.isArray(body.targetExams) ? body.targetExams : [],
      country: body.country?.trim() || "India",
      dataType: body.dataType?.trim() || "Organic",
      sheetTab: body.sheetTab || "ongoing",
      rowTone: body.rowTone || "new",
      followUpDate: body.followUpDate || null,
      date: body.date || new Date().toISOString().slice(0, 10),
      workspaceNotes: body.workspaceNotes || "",
      activityLog: Array.isArray(body.activityLog) ? body.activityLog : [],
      callHistory: Array.isArray(body.callHistory) ? body.callHistory : [],
      notInterestedRemark: body.notInterestedRemark || null,
      pipelineSteps: body.pipelineSteps || 0,
    };

    // Handle pipelineMeta with merge
    if (body.pipelineMeta && typeof body.pipelineMeta === "object") {
      leadData.pipelineMeta = mergePipelineMeta({}, body.pipelineMeta);
    } else {
      leadData.pipelineMeta = {};
    }

    // Create the lead
    const newLead = await Lead.create(leadData);

    return NextResponse.json({
      success: true,
      lead: {
        id: newLead._id,
        studentName: newLead.studentName,
        phone: newLead.phone,
        email: newLead.email,
        sheetTab: newLead.sheetTab,
        rowTone: newLead.rowTone,
        createdAt: newLead.createdAt,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Lead import error:", error);
    
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        { error: "Validation error", details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads/import
 * Returns the expected schema for lead import
 */
export async function GET() {
  return NextResponse.json({
    description: "API endpoint to import leads from external applications",
    authentication: {
      session: "auth-token cookie (session-based)",
      apiKey: "x-api-key header (set LEAD_IMPORT_API_KEY in .env)"
    },
    requestBody: {
      studentName: "string (required)",
      parentName: "string (optional)",
      phone: "string (optional)",
      email: "string (optional)",
      parentEmail: "string (optional)",
      grade: "string (optional, default: '12th')",
      targetExams: "array of strings (optional, default: [])",
      country: "string (optional, default: 'India')",
      dataType: "string (optional, default: 'Organic')",
      sheetTab: "string (optional, default: 'ongoing', enum: today, ongoing, followup, not_interested, converted)",
      rowTone: "string (optional, default: 'new', enum: interested, not_interested, followup_later, new, called_no_response)",
      followUpDate: "string (optional, format: YYYY-MM-DD)",
      date: "string (optional, format: YYYY-MM-DD, default: today)",
      workspaceNotes: "string (optional)",
      activityLog: "array of objects (optional, each with: at, kind, message)",
      callHistory: "array of objects (optional, each with: at, outcome, duration, notes)",
      notInterestedRemark: "string (optional, max 2000 chars)",
      pipelineSteps: "number (optional, default: 0, min: 0, max: 4)",
      pipelineMeta: "object (optional, contains: demo, brochure, studentReport, documents, fees, schedule)"
    },
    example: {
      studentName: "John Doe",
      parentName: "Jane Doe",
      phone: "+919876543210",
      email: "john@example.com",
      parentEmail: "parent@example.com",
      grade: "12th",
      targetExams: ["NEET", "JEE"],
      country: "India",
      dataType: "Organic",
      sheetTab: "ongoing",
      rowTone: "new",
      followUpDate: "2024-12-31",
      workspaceNotes: "Initial notes from external app",
      activityLog: [
        {
          at: new Date().toISOString(),
          kind: "import",
          message: "Lead imported from external application"
        }
      ],
      pipelineMeta: {
        demo: { rows: [] },
        brochure: {},
        fees: {},
        schedule: {}
      }
    }
  });
}
