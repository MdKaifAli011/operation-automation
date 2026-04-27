import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AllLeadModel from "@/models/AllLead";
import EmailQueueModel from "@/models/EmailQueue";

export const runtime = "nodejs";

type PostBody = {
  leadIds: string[];
  actions: Array<"brochure" | "bank_details" | "fee_details">;
  brochureEmail?: {
    selectionKeys: string[];
    includeStudentReportPdf: boolean;
  };
};

/**
 * POST: Add email jobs to queue for batch processing
 * Instead of sending emails directly, adds them to the queue
 * The worker processes them one by one
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    const { leadIds, actions, brochureEmail } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "leadIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json(
        { error: "actions is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    await connectDB();

    // Fetch all leads
    const leads = await AllLeadModel.find({ _id: { $in: leadIds } });
    
    if (leads.length === 0) {
      return NextResponse.json(
        { error: "No leads found" },
        { status: 404 }
      );
    }

    // Add jobs to queue
    const jobs = [];
    for (const lead of leads) {
      const to = lead.email || lead.parentEmail;
      if (!to) {
        // Mark lead as failed if no email
        await AllLeadModel.updateOne(
          { _id: lead._id },
          { emailStatus: "failed", emailError: "No email address" }
        );
        continue;
      }

      const job = await EmailQueueModel.create({
        leadId: lead._id.toString(),
        leadName: lead.studentName,
        toEmail: to,
        actions,
        brochureEmail,
        status: "pending",
      });

      // Mark lead as queued
      await AllLeadModel.updateOne(
        { _id: lead._id },
        { emailStatus: "queued" }
      );

      jobs.push(job._id.toString());
    }

    return NextResponse.json({
      success: true,
      queued: jobs.length,
      jobIds: jobs,
    });
  } catch (error) {
    console.error("Error adding jobs to email queue:", error);
    return NextResponse.json(
      { error: "Failed to add jobs to queue" },
      { status: 500 }
    );
  }
}
