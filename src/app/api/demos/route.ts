import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";
import { mergePipelineMeta } from "@/lib/pipeline";
import { sendLeadPipelineEmail } from "@/lib/leadPipelineEmailClient";

export async function GET() {
  try {
    await connectDB();

    // Fetch all leads with demo rows
    const leads = await LeadModel.find({
      "pipelineMeta.demo.rows": { $exists: true, $ne: [] },
    }).lean();

    // Flatten all demo rows with lead information
    const demos: Array<{
      leadId: string;
      studentName: string;
      email: string | null;
      phone: string;
      targetExams: string[];
      country: string;
      grade: string;
      meetRowId: string;
      subject: string;
      teacher: string;
      isoDate: string;
      timeHmIST: string;
      status: "Scheduled" | "Completed" | "Cancelled";
      studentTimeZone: string;
      meetLinkUrl: string;
      meetBookingId: string;
      meetWindowStartIso: string;
      meetWindowEndIso: string;
      examValue: string;
    }> = [];

    for (const lead of leads) {
      const meta = lead.pipelineMeta as { demo?: { rows?: DemoTableRowPersisted[] } } | undefined;
      const rows = meta?.demo?.rows ?? [];

      for (const row of rows) {
        demos.push({
          leadId: String(lead._id),
          studentName: lead.studentName || "Student",
          email: lead.email || null,
          phone: lead.phone || "",
          targetExams: lead.targetExams || [],
          country: lead.country || "",
          grade: lead.grade || "",
          meetRowId: row.meetRowId || "",
          subject: row.subject || "",
          teacher: row.teacher || "",
          isoDate: row.isoDate || "",
          timeHmIST: row.timeHmIST || "",
          status: (row.status || "Scheduled") as "Scheduled" | "Completed" | "Cancelled",
          studentTimeZone: row.studentTimeZone || "",
          meetLinkUrl: row.meetLinkUrl || "",
          meetBookingId: row.meetBookingId || "",
          meetWindowStartIso: row.meetWindowStartIso || "",
          meetWindowEndIso: row.meetWindowEndIso || "",
          examValue: row.examValue || "",
        });
      }
    }

    return NextResponse.json(demos);
  } catch (error) {
    console.error("Error fetching demos:", error);
    return NextResponse.json(
      { error: "Failed to fetch demos" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { leadId, meetRowId, newStatus } = body;

    if (!leadId || !meetRowId || !newStatus) {
      return NextResponse.json(
        { error: "Missing required fields: leadId, meetRowId, newStatus" },
        { status: 400 }
      );
    }

    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    const meta = lead.pipelineMeta as { demo?: { rows?: DemoTableRowPersisted[] } } | undefined;
    const rows = meta?.demo?.rows ?? [];
    
    const rowIndex = rows.findIndex((r) => String(r.meetRowId) === String(meetRowId));
    if (rowIndex === -1) {
      return NextResponse.json(
        { error: "Demo row not found" },
        { status: 404 }
      );
    }

    // Update the demo status
    const updatedRows = [...rows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], status: newStatus };

    // Merge the updated demo rows
    const updatedMeta = mergePipelineMeta(lead.pipelineMeta || {}, {
      demo: { rows: updatedRows },
    });

    // Update the lead
    lead.pipelineMeta = updatedMeta;
    await lead.save();

    // Send email notification based on status change
    if (newStatus) {
      try {
        await sendLeadPipelineEmail(lead.id, {
          templateKey: "demo_status_update",
          meetRowId,
          demoStatusEmail: {
            status: newStatus,
            notifyParent: true,
            notifyFaculty: false,
          },
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating demo status:", error);
    return NextResponse.json(
      { error: "Failed to update demo status" },
      { status: 500 }
    );
  }
}
