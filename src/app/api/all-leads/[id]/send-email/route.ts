import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AllLeadModel from "@/models/AllLead";
import EmailQueueModel from "@/models/EmailQueue";

export const runtime = "nodejs";

type PostBody = {
  templateKey?: string;
  brochureEmail?: {
    selectionKeys: string[];
    includeStudentReportPdf: boolean;
  };
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid all-lead id." }, { status: 400 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const templateKeyRaw = body.templateKey;
  if (typeof templateKeyRaw !== "string") {
    return NextResponse.json(
      { error: "Unknown or missing templateKey." },
      { status: 400 },
    );
  }

  // Map UI action names to template keys
  const actionToTemplateKey: Record<string, string> = {
    "course_brochure": "brochure",
    "bank_details": "bank_details",
    "fee_details": "fees",
  };
  
  const templateKey = actionToTemplateKey[templateKeyRaw] || templateKeyRaw;

  try {
    await connectDB();

    const allLead = await AllLeadModel.findById(id);
    if (!allLead) {
      return NextResponse.json({ error: "AllLead not found." }, { status: 404 });
    }

    const to = allLead.email || allLead.parentEmail;
    if (!to) {
      // Mark lead as failed if no email
      await AllLeadModel.updateOne(
        { _id: id },
        { emailStatus: "failed", emailError: "No email address" }
      );
      return NextResponse.json(
        { error: "No email address found for this lead." },
        { status: 400 },
      );
    }

    // Add job to queue (no immediate processing)
    const actions = [templateKey as "brochure" | "bank_details" | "fees"];
    const job = await EmailQueueModel.create({
      leadId: id,
      leadName: allLead.studentName,
      toEmail: to,
      actions,
      brochureEmail: body.brochureEmail,
      status: "pending",
    });

    // Mark lead as queued
    await AllLeadModel.updateOne(
      { _id: id },
      { emailStatus: "queued" }
    );

    return NextResponse.json({ 
      success: true, 
      queued: true, 
      jobId: job._id.toString() 
    });
  } catch (error) {
    console.error("Error adding email job to queue:", error);
    return NextResponse.json(
      { error: "Failed to queue email" },
      { status: 500 },
    );
  }
}
