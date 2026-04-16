import type { EmailTemplateKey } from "@/lib/email/templateKeys";
import { buildLeadEmailVars } from "@/lib/email/buildLeadEmailVars";
import { mergeFeeEmailVarsWithBankDetails } from "@/lib/email/feeBankDetailsForEmail";
import { ensureFeeBankDetailsInRenderedHtml } from "@/lib/email/templateRenderedEnsures";
import { renderTemplate } from "@/lib/email/renderTemplate";
import { sendMail } from "@/lib/email/sendMail";
import { getEnrollmentTeamBccEmails } from "@/lib/email/enrollmentRecipients";
import { normalizeMailRecipients } from "@/lib/email/mailRecipients";

type Lean = Parameters<typeof buildLeadEmailVars>[0];

export type FeesEnrollmentTemplateLean = {
  key: string;
  subject?: string;
  bodyHtml?: string;
  enabled?: boolean;
};

/**
 * One email: fee structure body + enrollment body, BCC enrollment team.
 */
export async function sendFeesEnrollmentBundleEmail(opts: {
  to: string;
  lead: Lean;
  feesTmpl: FeesEnrollmentTemplateLean;
  enrollmentTmpl: FeesEnrollmentTemplateLean;
}): Promise<void> {
  const { to, lead, feesTmpl, enrollmentTmpl } = opts;
  let feeVars = buildLeadEmailVars(lead, "fees" as EmailTemplateKey);
  feeVars = await mergeFeeEmailVarsWithBankDetails(lead, feeVars);
  const enrollVars = buildLeadEmailVars(lead, "enrollment" as EmailTemplateKey);
  const feeBody = String(feesTmpl.bodyHtml ?? "");
  let feeHtml = renderTemplate(feeBody, feeVars);
  feeHtml = ensureFeeBankDetailsInRenderedHtml(
    feeBody,
    feeHtml,
    feeVars.feeBankDetailsHtml ?? "",
  );
  const enrollHtml = renderTemplate(String(enrollmentTmpl.bodyHtml ?? ""), enrollVars);
  const feeSubj = renderTemplate(String(feesTmpl.subject ?? "Fee structure"), feeVars);
  const enrollSubj = renderTemplate(
    String(enrollmentTmpl.subject ?? "Enrollment"),
    enrollVars,
  );
  const subject = `${feeSubj} · ${enrollSubj}`;
  const html = `${feeHtml}<div style="height:20px;"></div>${enrollHtml}`;

  const bccList = getEnrollmentTeamBccEmails();
  const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
  await sendMail({ to: toNorm, subject, html });
  if (bcc) {
    let feeVarsTeam = buildLeadEmailVars(lead, "fees" as EmailTemplateKey, {
      recipientType: "enrollment_team",
    });
    feeVarsTeam = await mergeFeeEmailVarsWithBankDetails(lead, feeVarsTeam);
    const enrollVarsTeam = buildLeadEmailVars(lead, "enrollment" as EmailTemplateKey, {
      recipientType: "enrollment_team",
    });
    const feeBodyTeam = String(feesTmpl.bodyHtml ?? "");
    let feeHtmlTeam = renderTemplate(feeBodyTeam, feeVarsTeam);
    feeHtmlTeam = ensureFeeBankDetailsInRenderedHtml(
      feeBodyTeam,
      feeHtmlTeam,
      feeVarsTeam.feeBankDetailsHtml ?? "",
    );
    const enrollHtmlTeam = renderTemplate(
      String(enrollmentTmpl.bodyHtml ?? ""),
      enrollVarsTeam,
    );
    const feeSubjTeam = renderTemplate(
      String(feesTmpl.subject ?? "Fee structure"),
      feeVarsTeam,
    );
    const enrollSubjTeam = renderTemplate(
      String(enrollmentTmpl.subject ?? "Enrollment"),
      enrollVarsTeam,
    );
    const subjectTeam = `${feeSubjTeam} · ${enrollSubjTeam}`;
    const htmlTeam = `${feeHtmlTeam}<div style="height:20px;"></div>${enrollHtmlTeam}`;
    await sendMail({ to: bcc, subject: subjectTeam, html: htmlTeam });
  }
}
