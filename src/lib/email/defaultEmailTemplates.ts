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
    key: "brochure",
    name: "Brochure",
    description: "Course brochure and overview.",
    sortOrder: 20,
    subject: "Course brochure — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Please find the course information for <strong>{{studentName}}</strong> below.</p>
<p><strong>{{brochureLabel}}</strong></p>
<p><a href="{{brochureLink}}">Open brochure</a></p>
<p><small>If the link is empty, add a document URL or upload on the lead first.</small></p>
<p>Regards,<br/>Team</p>`,
  },
  {
    key: "fees",
    name: "Fee structure",
    description: "Fee and installment summary.",
    sortOrder: 30,
    subject: "Fee structure — {{studentName}}",
    bodyHtml: `<p>Hello {{parentName}},</p>
<p>Sharing the fee details for <strong>{{studentName}}</strong>:</p>
<pre style="font-family:inherit;white-space:pre-wrap;">{{feeSummary}}</pre>
<p>Regards,<br/>Team</p>`,
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
