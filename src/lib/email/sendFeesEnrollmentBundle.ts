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
  const html = `<div style="font-family:system-ui,'Segoe UI',sans-serif;font-size:15px;line-height:1.55;color:#212121;max-width:640px;">
<div style="margin:0 0 14px;padding:10px 14px;background:linear-gradient(90deg,#e3f2fd 0%,#f5f5f5 100%);border-left:4px solid #1565c0;font-weight:700;font-size:15px;color:#0d47a1;">Fee &amp; payment details</div>
<div style="padding:0 4px 8px;">${feeHtml}</div>
<div style="margin:24px 0 16px;height:1px;background:linear-gradient(90deg,transparent,#e0e0e0,transparent);"></div>
<div style="margin:0 0 14px;padding:10px 14px;background:linear-gradient(90deg,#f3e5f5 0%,#fafafa 100%);border-left:4px solid #7b1fa2;font-weight:700;font-size:15px;color:#4a148c;">Enrollment form</div>
<div style="padding:0 4px;">${enrollHtml}</div>
</div>`;

  const bccList = getEnrollmentTeamBccEmails();
  const { to: toNorm, bcc } = normalizeMailRecipients(to, undefined, bccList);
  await sendMail({ to: toNorm, subject, html, bcc });
}
