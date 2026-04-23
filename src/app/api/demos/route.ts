import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import type { DemoTableRowPersisted } from "@/lib/leadPipelineMetaTypes";

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
