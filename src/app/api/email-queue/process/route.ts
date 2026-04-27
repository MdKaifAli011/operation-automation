import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import EmailQueueModel from "@/models/EmailQueue";
import AllLeadModel from "@/models/AllLead";
import EmailTemplateModel from "@/models/EmailTemplate";
import ExamBrochureTemplateModel from "@/models/ExamBrochureTemplate";
import { ensureDefaultTemplates } from "@/lib/email/ensureDefaultTemplates";
import { renderTemplate } from "@/lib/email/renderTemplate";
import { sendMail } from "@/lib/email/sendMail";
import { buildBrochureBundleEmailVars } from "@/lib/email/buildBrochureBundleEmailVars";
import {
  ensureBrochureBundleHtmlInRenderedHtml,
  ensureFeeDetailsInRenderedHtml,
  ensureFeeBankDetailsInRenderedHtml,
} from "@/lib/email/templateRenderedEnsures";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";
import { normalizeMailRecipients } from "@/lib/email/mailRecipients";
import {
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";
import { brochureItemsFromDoc } from "@/lib/examBrochureTemplates";
import { buildFeeDetailsHtmlForLead } from "@/lib/email/buildFeeDetailsForEmail";
import { mergeFeeEmailVarsWithBankDetails } from "@/lib/email/feeBankDetailsForEmail";

export const runtime = "nodejs";

/**
 * Process one email job from the queue
 * Called by the worker to send emails one by one
 */
export async function POST() {
  try {
    await connectDB();

    // Find the oldest pending job
    const job = await EmailQueueModel.findOne({ status: "pending" }).sort({ createdAt: 1 });
    
    if (!job) {
      return NextResponse.json({ success: true, message: "No pending jobs" });
    }

    console.log("Processing email job:", {
      jobId: job._id.toString(),
      leadId: job.leadId,
      leadName: job.leadName,
      toEmail: job.toEmail,
      actions: job.actions,
    });

    // Mark as processing
    await EmailQueueModel.updateOne(
      { _id: job._id },
      { status: "processing", processedAt: new Date() }
    );

    // Fetch lead data
    const lead = await AllLeadModel.findById(job.leadId);
    if (!lead) {
      console.error("Lead not found for job:", job.leadId);
      await EmailQueueModel.updateOne(
        { _id: job._id },
        { status: "failed", error: "Lead not found", completedAt: new Date() }
      );
      await AllLeadModel.updateOne(
        { _id: job.leadId },
        { emailStatus: "failed", emailError: "Lead not found" }
      );
      return NextResponse.json({ success: false, error: "Lead not found" });
    }

    const to = lead.email || lead.parentEmail;
    if (!to) {
      console.error("No email address for lead:", job.leadId);
      await EmailQueueModel.updateOne(
        { _id: job._id },
        { status: "failed", error: "No email address", completedAt: new Date() }
      );
      await AllLeadModel.updateOne(
        { _id: job.leadId },
        { emailStatus: "failed", emailError: "No email address" }
      );
      return NextResponse.json({ success: false, error: "No email address" });
    }

    // Ensure default templates exist
    await ensureDefaultTemplates();

    // Fetch brochure docs if needed
    const brochureDocs = await ExamBrochureTemplateModel.find({}).lean();

    const results = [];
    
    for (const action of job.actions) {
      const templateKey = action as EmailTemplateKey;
      console.log("Processing action:", templateKey, "for lead:", job.leadId);
      
      const tmpl = await EmailTemplateModel.findOne({ key: templateKey });
      if (!tmpl) {
        console.error("Template not found:", templateKey);
        results.push({ action, success: false, error: "Template not found" });
        continue;
      }

      let vars: Record<string, string>;
      try {
        if (templateKey === "brochure") {
          const sel = job.brochureEmail?.selectionKeys || lead.targetExams;
          const examNames = Array.isArray(sel) ? sel.map((k) => String(k ?? "").trim()).filter(Boolean) : [];
          const includePdf = job.brochureEmail?.includeStudentReportPdf === true;

          if (examNames.length === 0 && !includePdf) {
            results.push({ action, success: false, error: "No brochures selected" });
            continue;
          }

          const compositeKeys: string[] = [];
          const leadExams = Array.isArray(lead.targetExams) ? lead.targetExams : [];
          
          for (const examName of examNames) {
            const matchingExam = leadExams.find(
              (e: string) => e.toLowerCase() === examName.toLowerCase()
            );
            
            if (!matchingExam) {
              continue;
            }

            for (const doc of brochureDocs) {
              const docExam = typeof doc.exam === "string" ? doc.exam.trim() : "";
              if (docExam.toLowerCase() !== matchingExam.toLowerCase()) continue;
              
              for (const b of brochureItemsFromDoc(doc)) {
                const composite = `${matchingExam}-${b.key}`;
                if (!compositeKeys.includes(composite)) {
                  compositeKeys.push(composite);
                }
              }
            }
          }

          if (compositeKeys.length === 0 && !includePdf) {
            results.push({ action, success: false, error: "No valid brochures found" });
            continue;
          }

          vars = await buildBrochureBundleEmailVars(
            {
              studentName: lead.studentName,
              parentName: lead.parentName || "Parent",
              email: to,
              targetExams: lead.targetExams,
              grade: lead.grade,
              country: lead.country,
              phone: lead.phone,
            } as { studentName: string; parentName: string; email: string; targetExams: string[]; grade: string; country: string; phone: string },
            {
              selectionKeys: compositeKeys,
              includeStudentReportPdf: includePdf,
            },
          );
        } else {
          vars = {
            studentName: lead.studentName,
            parentName: lead.parentName || "Parent",
            email: to,
            targetExams: lead.targetExams.join(", "),
            grade: lead.grade,
            country: lead.country,
            phone: lead.phone,
            recipientGreeting: lead.parentName || "Parent",
          };
        }

        if (templateKey === "fees" || templateKey === "bank_details") {
          const feeDetailsHtml = await buildFeeDetailsHtmlForLead({
            targetExams: lead.targetExams,
            grade: lead.grade,
          });
          vars.feeSummaryHtml = feeDetailsHtml;
          
          vars = await mergeFeeEmailVarsWithBankDetails(lead, vars);
        }

        const subject = renderTemplate(String(tmpl.subject), vars);
        let html = renderTemplate(String(tmpl.bodyHtml), vars);

        if (templateKey === "brochure") {
          html = ensureBrochureBundleHtmlInRenderedHtml(
            String(tmpl.bodyHtml),
            html,
            vars.brochureBundleHtml ?? "",
          );
          const bccList = getEnrollmentTeamBccEmails();
          const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
          await sendMail({ to: toNorm, subject, html });
          if (bcc) {
            const varsTeam: Record<string, string> = {
              ...vars,
              recipientGreeting: "Enrollment Team",
            };
            let htmlTeam = renderTemplate(String(tmpl.bodyHtml), varsTeam);
            htmlTeam = ensureBrochureBundleHtmlInRenderedHtml(
              String(tmpl.bodyHtml),
              htmlTeam,
              varsTeam.brochureBundleHtml ?? "",
            );
            const subjectTeam = renderTemplate(String(tmpl.subject), varsTeam);
            await sendMail({ to: bcc, subject: subjectTeam, html: htmlTeam });
          }
        } else if (templateKey === "fees" || templateKey === "bank_details") {
          html = ensureFeeDetailsInRenderedHtml(
            String(tmpl.bodyHtml),
            html,
            vars.feeSummaryHtml ?? "",
          );
          html = ensureFeeBankDetailsInRenderedHtml(
            String(tmpl.bodyHtml),
            html,
            vars.feeBankDetailsHtml ?? "",
          );
          const bccList = getEnrollmentTeamBccEmails();
          const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
          await sendMail({ to: toNorm, subject, html });
          if (bcc) {
            const varsTeam: Record<string, string> = {
              ...vars,
              recipientGreeting: "Enrollment Team",
            };
            let htmlTeam = renderTemplate(String(tmpl.bodyHtml), varsTeam);
            htmlTeam = ensureFeeDetailsInRenderedHtml(
              String(tmpl.bodyHtml),
              htmlTeam,
              varsTeam.feeSummaryHtml ?? "",
            );
            htmlTeam = ensureFeeBankDetailsInRenderedHtml(
              String(tmpl.bodyHtml),
              htmlTeam,
              varsTeam.feeBankDetailsHtml ?? "",
            );
            const subjectTeam = renderTemplate(String(tmpl.subject), varsTeam);
            await sendMail({ to: bcc, subject: subjectTeam, html: htmlTeam });
          }
        } else {
          await sendMail({ to, subject, html });
        }

        console.log("Email sent successfully:", templateKey, "to:", to);
        results.push({ action, success: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Error sending email:", templateKey, "error:", msg);
        results.push({ action, success: false, error: msg });
      }
    }

    // Mark job as completed
    await EmailQueueModel.updateOne(
      { _id: job._id },
      { status: "completed", completedAt: new Date() }
    );

    // Update lead email status
    const hasFailure = results.some(r => !r.success);
    const status = hasFailure ? "failed" : "sent";
    const error = hasFailure ? results.find(r => !r.success)?.error : null;
    
    console.log("Updating lead status:", {
      leadId: job.leadId,
      status,
      error,
      results,
    });
    
    await AllLeadModel.updateOne(
      { _id: job.leadId },
      {
        emailStatus: status,
        emailSentAt: new Date(),
        emailError: error,
      }
    );

    return NextResponse.json({ success: true, results, leadId: job.leadId, status });
  } catch (error) {
    console.error("Error processing email queue job:", error);
    return NextResponse.json(
      { error: "Failed to process job" },
      { status: 500 }
    );
  }
}

/**
 * GET: Get queue status (pending count, processing count, etc.)
 */
export async function GET() {
  try {
    await connectDB();
    
    const pending = await EmailQueueModel.countDocuments({ status: "pending" });
    const processing = await EmailQueueModel.countDocuments({ status: "processing" });
    const completed = await EmailQueueModel.countDocuments({ status: "completed" });
    const failed = await EmailQueueModel.countDocuments({ status: "failed" });

    return NextResponse.json({
      pending,
      processing,
      completed,
      failed,
    });
  } catch (error) {
    console.error("Error getting queue status:", error);
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    );
  }
}
