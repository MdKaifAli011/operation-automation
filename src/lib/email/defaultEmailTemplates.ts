import type { EmailTemplateKey } from "@/lib/email/templateKeys";

export type DefaultTemplateSeed = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  sortOrder: number;
};

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplateSeed[] = [
  {
    key: "demo_invite",
    name: "Demo invite",
    description: "Share link for a scheduled trial class.",
    sortOrder: 10,
    subject: "Trial class details — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Here are the details for <strong>{{studentName}}</strong>&rsquo;s trial class:</p>
<p>{{demoSummary}}</p>
<p><strong>Join link:</strong> <a href="{{meetLink}}">{{meetLink}}</a></p>
<p>If the link is empty, assign a Meet link on the lead first (Step 1 · Demo).</p>
<p>If you have questions, reply to this email.</p>
<p>Regards,<br/>Team</p>`,
  },
  {
    key: "demo_status_update",
    name: "Demo status update",
    description:
      "Automatic family email when a trial is scheduled, completed, or canceled — premium layout; link only when scheduled.",
    sortOrder: 15,
    subject: "{{demoStatusEmailSubject}}",
    bodyHtml: `<div style="max-width:600px;margin:0 auto;font-family:Georgia,'Times New Roman',serif;color:#212121;">
{{demoStatusEmailBodyHtml}}
{{demoStatusMeetSectionHtml}}
<p style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e0e0e0;font-size:14px;line-height:1.6;color:#546e7a;">With best wishes,<br/><span style="font-weight:600;color:#1565c0;letter-spacing:0.02em;">Admissions Team</span></p>
</div>`,
  },
  {
    key: "brochure",
    name: "Brochure & documents",
    description: "Step 2 · catalog brochures and optional progress report PDF.",
    sortOrder: 20,
    subject: "Course materials — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Please find the course information and documents for <strong>{{studentName}}</strong> below.</p>
{{brochureBundleHtml}}
<p><small>If a link does not open, reply to this email for help.</small></p>
<p>Regards,<br/>Team</p>`,
  },
  {
    key: "courier_address",
    name: "Courier address request",
    description:
      "Request shipping details so documents can be delivered to the student.",
    sortOrder: 25,
    subject: "Address required for document delivery — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>We are ready to dispatch documents for <strong>{{studentName}}</strong>. Please reply with the details below so we can courier safely:</p>
<ul>
  <li>Student/receiver full name</li>
  <li>Complete delivery address (House/Flat, Street, Area, Landmark)</li>
  <li>City, State, Pincode</li>
  <li>Alternate mobile number (if any)</li>
  <li>Preferred delivery time window</li>
</ul>
<p>Once we receive these details, we will dispatch and share tracking information.</p>
<p>Regards,<br/>Team</p>`,
  },
  {
    key: "bank_details",
    name: "Bank details only",
    description: "Share selected bank details without fee summary.",
    sortOrder: 28,
    subject: "Bank account details — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>As requested, sharing the payment bank details for <strong>{{studentName}}</strong> below:</p>
{{feeBankDetailsHtml}}
<p style="margin-top:20px;">Regards,<br/>Team</p>`,
  },
  {
    key: "fees",
    name: "Fee structure",
    description: "Fee, installments, and bank details for payment.",
    sortOrder: 30,
    subject: "Fee & payment details — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Sharing the fee and payment details for <strong>{{studentName}}</strong>:</p>
{{feeSummaryHtml}}
{{feeBankDetailsHtml}}
<p style="margin-top:20px;">Regards,<br/>Team</p>`,
  },
  {
    key: "enrollment",
    name: "Enrollment form",
    description: "Link to complete enrollment.",
    sortOrder: 40,
    subject: "Enrollment form — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Please complete the enrollment form for <strong>{{studentName}}</strong>:</p>
<p><a href="{{enrollmentLink}}">{{enrollmentLink}}</a></p>
<p>Regards,<br/>Team</p>`,
  },
  {
    key: "schedule",
    name: "Class schedule",
    description: "Weekly class schedule.",
    sortOrder: 50,
    subject: "Class schedule — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Here is the class schedule for <strong>{{studentName}}</strong>:</p>
<pre style="font-family:inherit;white-space:pre-wrap;">{{scheduleSummary}}</pre>
<p>Regards,<br/>Team</p>`,
  },
];
