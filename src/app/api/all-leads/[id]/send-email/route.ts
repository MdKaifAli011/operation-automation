import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
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
  isEmailTemplateKey,
  type EmailTemplateKey,
} from "@/lib/email/templateKeys";
import { brochureItemsFromDoc } from "@/lib/examBrochureTemplates";
import { buildFeeDetailsHtmlForLead } from "@/lib/email/buildFeeDetailsForEmail";
import { mergeFeeEmailVarsWithBankDetails } from "@/lib/email/feeBankDetailsForEmail";

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
  if (typeof templateKeyRaw !== "string" || !isEmailTemplateKey(templateKeyRaw)) {
    return NextResponse.json(
      { error: "Unknown or missing templateKey." },
      { status: 400 },
    );
  }
  const templateKey = templateKeyRaw as EmailTemplateKey;

  try {
    await connectDB();
    await ensureDefaultTemplates();

    const allLead = await AllLeadModel.findById(id);
    if (!allLead) {
      return NextResponse.json({ error: "AllLead not found." }, { status: 404 });
    }

    // Fetch exam brochure templates for brochure resolution
    const brochureDocs = await ExamBrochureTemplateModel.find({}).lean();

    const tmpl = await EmailTemplateModel.findOne({ key: templateKey });
    if (!tmpl) {
      return NextResponse.json(
        { error: "Email template not found." },
        { status: 404 },
      );
    }

    if (tmpl.enabled === false) {
      return NextResponse.json(
        { error: "This template is disabled. Enable it under Email Templates Management." },
        { status: 400 },
      );
    }

    // Build email variables from AllLead
    const to = allLead.email || allLead.parentEmail;
    if (!to) {
      return NextResponse.json(
        { error: "No email address found for this lead." },
        { status: 400 },
      );
    }

    let vars: Record<string, string>;
    if (templateKey === "brochure") {
      if (!body.brochureEmail || typeof body.brochureEmail !== "object") {
        return NextResponse.json(
          {
            error:
              "Documents email requires brochureEmail: { selectionKeys, includeStudentReportPdf }.",
          },
          { status: 400 },
        );
      }
      const sel = body.brochureEmail.selectionKeys;
      const examNames = Array.isArray(sel) ? sel.map((k) => String(k ?? "").trim()).filter(Boolean) : [];
      const includePdf = body.brochureEmail.includeStudentReportPdf === true;

      if (examNames.length === 0 && !includePdf) {
        return NextResponse.json(
          { error: "Select at least one brochure or include student report PDF." },
          { status: 400 },
        );
      }

      // Build composite keys from exam names
      const compositeKeys: string[] = [];
      const leadExams = Array.isArray(allLead.targetExams) ? allLead.targetExams : [];
      
      for (const examName of examNames) {
        // Find matching exam in lead's target exams
        const matchingExam = leadExams.find(
          (e: string) => e.toLowerCase() === examName.toLowerCase()
        );
        
        if (!matchingExam) {
          continue; // Skip if exam not in lead's target exams
        }

        // Find brochure items for this exam
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
        return NextResponse.json(
          { error: "No valid brochures found for selected exams." },
          { status: 400 },
        );
      }

      try {
        vars = await buildBrochureBundleEmailVars(
          {
            studentName: allLead.studentName,
            parentName: allLead.parentName || "Parent",
            email: to,
            targetExams: allLead.targetExams,
            grade: allLead.grade,
            country: allLead.country,
            phone: allLead.phone,
          } as { studentName: string; parentName: string; email: string; targetExams: string[]; grade: string; country: string; phone: string },
          {
            selectionKeys: compositeKeys,
            includeStudentReportPdf: includePdf,
          },
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Invalid brochure or report selection.";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    } else {
      // Build basic email variables for other templates
      vars = {
        studentName: allLead.studentName,
        parentName: allLead.parentName || "Parent",
        email: to,
        targetExams: allLead.targetExams.join(", "),
        grade: allLead.grade,
        country: allLead.country,
        phone: allLead.phone,
        recipientGreeting: allLead.parentName || "Parent",
      };
    }

    if (templateKey === "fees" || templateKey === "bank_details") {
      // Build fee details HTML based on grade and target exams
      const feeDetailsHtml = await buildFeeDetailsHtmlForLead({
        targetExams: allLead.targetExams,
        grade: allLead.grade,
      });
      vars.feeSummaryHtml = feeDetailsHtml;
      
      // Merge bank details
      vars = await mergeFeeEmailVarsWithBankDetails(allLead, vars);
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error sending email for AllLead:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
