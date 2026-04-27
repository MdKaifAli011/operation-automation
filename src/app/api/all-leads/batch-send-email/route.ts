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
 * POST: Add email jobs to queue only (no immediate processing)
 * Jobs will be processed by the background worker
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PostBody;
    const { leadIds, actions, brochureEmail } = body;

    console.log("Batch send request body:", { leadIds, actions, brochureEmail });

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      console.error("Invalid leadIds:", leadIds);
      return NextResponse.json(
        { error: "leadIds is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!Array.isArray(actions) || actions.length === 0) {
      console.error("Invalid actions:", actions);
      return NextResponse.json(
        { error: "actions is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    await connectDB();

    // Map UI action names to template keys
    const actionToTemplateKey: Record<string, string> = {
      "brochure": "brochure",
      "bank_details": "bank_details",
      "fee_details": "fees",
    };
    
    const mappedActions = actions.map(a => actionToTemplateKey[a] || a);

    // Fetch all leads
    console.log("Fetching leads with IDs:", leadIds);
    const leads = await AllLeadModel.find({ _id: { $in: leadIds } });
    console.log("Found leads:", leads.length);
    
    if (leads.length === 0) {
      console.error("No leads found for IDs:", leadIds);
      return NextResponse.json(
        { error: "No leads found. Please check if the selected leads exist." },
        { status: 404 }
      );
    }

    // Add jobs to queue
    const jobs = [];
    for (const lead of leads) {
      const to = lead.email || lead.parentEmail;
      if (!to) {
        // Mark lead as failed if no email
        console.log("Marking lead as failed (no email):", lead._id.toString(), lead.studentName);
        await AllLeadModel.updateOne(
          { _id: lead._id },
          { emailStatus: "failed", emailError: "No email address" }
        );
        continue;
      }

      console.log("Adding job to queue for lead:", lead._id.toString(), lead.studentName, "email:", to);
      const job = await EmailQueueModel.create({
        leadId: lead._id.toString(),
        leadName: lead.studentName,
        toEmail: to,
        actions: mappedActions,
        brochureEmail,
        status: "pending",
      });

      // Mark lead as queued
      console.log("Marking lead as queued:", lead._id.toString(), lead.studentName);
      await AllLeadModel.updateOne(
        { _id: lead._id },
        { emailStatus: "queued" }
      );

      jobs.push(job._id.toString());
    }

    console.log("Added", jobs.length, "jobs to queue for", jobs.length, "leads");
    console.log("Only these", jobs.length, "leads will have their status updated");

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
