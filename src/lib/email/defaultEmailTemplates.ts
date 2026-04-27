import type { EmailTemplateKey } from "@/lib/email/templateKeys";

export type DefaultTemplateSeed = {
  key: EmailTemplateKey;
  name: string;
  description: string;
  subject: string;
  bodyHtml: string;
  sortOrder: number;
};

const EMAIL_LOGO_URL = "https://testprepkart.com/self-study/logo.png";

function emailShell(opts: {
  preHeader: string;
  badge: string;
  body: string;
}): string {
  return `<div style="margin:0;padding:0;background:#eef2f7;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#1e293b;">
  <div style="max-width:600px;margin:36px auto;padding:0 16px 40px;">
    <div style="text-align:center;font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:12px;">${opts.preHeader}</div>
    <div style="background:#0f2a4a;border-radius:14px 14px 0 0;padding:16px 24px;border-bottom:3px solid #1e6bbf;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td valign="middle" style="padding-right:20px;">
            <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:7px 16px;border:1px solid #e2e8f0;">
              <img src="${EMAIL_LOGO_URL}" alt="Logo" style="height:28px;width:auto;display:block;" />
            </div>
          </td>
          <td valign="middle" align="right">
            <div style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:50px;padding:5px 14px;font-size:11px;font-weight:500;letter-spacing:.8px;color:#93c5fd;white-space:nowrap;">
              <span style="width:6px;height:6px;background:#22c55e;border-radius:50%;display:inline-block;margin-right:7px;vertical-align:middle;"></span>
              <span style="vertical-align:middle;">${opts.badge}</span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#ffffff;padding:36px 40px 32px;">
${opts.body}
    </div>
    <div style="background:#0f2a4a;border-radius:0 0 14px 14px;padding:24px 24px 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td valign="top" style="padding:0 20px 16px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="display:inline-block;background:#ffffff;border-radius:8px;padding:5px 12px;margin-bottom:8px;border:1px solid #e2e8f0;"><img src="${EMAIL_LOGO_URL}" alt="Logo" style="height:22px;width:auto;display:block;" /></div>
            <div style="font-size:11px;color:#64748b;line-height:1.6;">Empowering students to achieve<br/>their medical aspirations.</div>
          </td>
          <td valign="top" align="right" style="padding:0 0 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#3b82f6;margin-bottom:10px;">Contact Us</div>
            <div style="font-size:12.5px;color:#93c5fd;line-height:1.7;">
              <div style="margin-bottom:2px;">enrolments@testprepkart.com</div>
              <div style="margin-bottom:2px;">+91 8800 123 492</div>
              <div>www.testprepkart.com</div>
            </div>
          </td>
        </tr>
        <tr>
          <td valign="middle" style="padding-top:14px;font-size:11px;color:#475569;">
            <span style="vertical-align:middle;"> 2025</span>
            <img src="${EMAIL_LOGO_URL}" alt="Logo" style="height:13px;width:auto;display:inline-block;vertical-align:middle;margin:0 7px;" />
            <span style="vertical-align:middle;">All rights reserved.</span>
          </td>
          <td valign="middle" align="right" style="padding-top:14px;">
            <div style="font-size:10px;color:#64748b;">
              <a href="#" style="color:#64748b;text-decoration:none;">Unsubscribe</a>
            </div>
          </td>
        </tr>
      </table>
    </div>
  </div>
</div>`;
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultTemplateSeed[] = [
  {
    key: "demo_invite",
    name: "Demo invite",
    description: "Share link for a scheduled trial class.",
    sortOrder: 10,
    subject: "Analysis Session Scheduled For {{studentName}} for {{targetExams}}",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Session Confirmation",
      badge: "Session Confirmed",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">Thank you for speaking with our Course Counsellor. We are pleased to confirm that an <strong style="color:#1e293b;">Academic Analysis Session</strong> has been scheduled for <strong style="color:#1e293b;">{{studentName}}</strong>. Please find all the relevant session details below.</p>
<div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:16px;">Session Details</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;width:150px;">📅 Date</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">{{sessionDate}}</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">🕗 Time</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">{{sessionTime}} IST</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">📘 Subject</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">{{subject}}</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">👩‍🏫 Faculty</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">{{facultyName}}</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#64748b;">⏱ Duration</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;font-size:13.5px;color:#0f2a4a;font-weight:600;">{{duration}}</td></tr>
    <tr><td style="padding:9px 0;font-size:13.5px;color:#64748b;">🔗 Session Link</td><td style="padding:9px 0;font-size:13.5px;font-weight:600;"><a href="{{sessionLink}}" style="color:#2563eb;text-decoration:none;border-bottom:1px dashed #93c5fd;">Click here to join →</a></td></tr>
  </table>
</div>
<div style="text-align:center;margin:26px 0 6px;">
  <a href="{{sessionLink}}" style="display:inline-block;background:#0f2a4a;color:#ffffff !important;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.4px;padding:14px 44px;border-radius:8px;box-shadow:0 4px 14px rgba(15,42,74,0.22);">Join Session Now</a>
</div>
<p style="text-align:center;font-size:11.5px;color:#94a3b8;margin:9px 0 0;">The link will be active 30 minutes before the session begins.</p>
<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b45309;margin-bottom:13px;">Important Instructions</div>
  <ol style="margin:0;padding-left:20px;color:#78350f;font-size:13.5px;line-height:1.75;">
    <li style="margin-bottom:8px;">Please ensure <strong>{{studentName}}</strong> joins at least 30 minutes early to test their device, microphone, and internet connection.</li>
    <li style="margin-bottom:8px;">This is a <strong>relaxed exploration session</strong> — no assessments, no prior preparation needed. {{studentName}} can come just as they are.</li>
    <li>This session will be between the student and the faculty only. Our counsellor will follow up with you separately with a detailed analysis report.</li>
  </ol>
</div>
<p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.8;">We look forward to a wonderful session with {{studentName}}. Should you have any questions in the meantime, please do not hesitate to reach out — we are always here to help.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "demo_status_update",
    name: "Demo status update",
    description:
      "Automatic family email when a trial is scheduled, completed, or canceled — premium layout; link only when scheduled.",
    sortOrder: 15,
    subject: "{{studentName}} Analysis Session Report For {{targetExams}} - TestprepKart",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Session Analysis Report",
      badge: "Report Ready",
      body: `{{demoStatusEmailBodyHtml}}
{{demoStatusMeetSectionHtml}}
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "brochure",
    name: "Brochure & documents",
    description: "Step 2 · catalog brochures and optional progress report PDF.",
    sortOrder: 20,
    subject: "{{targetExams}} Course Brochure ( {{studentName}} )",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Course Information",
      badge: "Course Brochure",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">Thank you for your interest in our NEET Preparation Programme. As discussed, please find the detailed course brochure attached to this email. We hope it gives you and {{studentName}} a clear and comprehensive picture of everything our programme has to offer.</p>
<div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:16px;">What the Brochure Covers</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;width:160px;color:#64748b;font-size:13.5px;">📚 Curriculum</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Complete subject-wise syllabus breakdown</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#64748b;font-size:13.5px;">🧑‍🏫 Faculty</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Profiles of our expert NEET educators</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#64748b;font-size:13.5px;">🕐 Schedule</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Batch timings and session frequency</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#64748b;font-size:13.5px;">🏆 Results</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Our past students' achievements and rankings</td></tr>
    <tr><td style="padding:9px 0;color:#64748b;font-size:13.5px;">📦 Inclusions</td><td style="padding:9px 0;color:#0f2a4a;font-size:13.5px;font-weight:600;">Study material, test series & mentoring details</td></tr>
  </table>
</div>
{{brochureBundleHtml}}
<p style="margin:14px 0 0;font-size:14px;color:#475569;line-height:1.8;">Our Course Counsellor is available to take you through any section of the brochure in detail and address any questions you may have. We want to ensure that you have all the information needed to make the best decision for {{studentName}}'s future.</p>
<p style="margin:14px 0 0;font-size:14px;color:#475569;line-height:1.8;">For any clarifications or to schedule a call with our counsellor, please reach out to us — we are happy to assist.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "courier_address",
    name: "Courier address request",
    description:
      "Request shipping details so documents can be delivered to the student.",
    sortOrder: 25,
    subject: "Courier Address Details For {{targetExams}} Study Material",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Shipping Details",
      badge: "Address Required",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">We are progressing well with {{studentName}}'s enrolment and are now preparing to dispatch the physical study material — books, notes, and practice resources — to your home.</p>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">To ensure timely and accurate delivery, we kindly request you to share your complete shipping address at the earliest. You may simply reply to this email with the details below.</p>
<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#15803d;margin-bottom:12px;">📦 Shipping Address Required</div>
  <p style="font-size:14px;color:#166534;line-height:1.75;margin:0 0 8px;">Please share the following details by replying to this email:</p>
  <p style="font-size:14px;color:#166534;line-height:1.85;margin:0;">
    🏠 <strong>Full Name</strong> (as on address label)<br/>
    📍 <strong>House / Flat No., Building Name</strong><br/>
    🗺 <strong>Street, Area, Locality</strong><br/>
    🏙 <strong>City & State</strong><br/>
    📮 <strong>PIN Code</strong><br/>
    📱 <strong>Alternate Contact Number</strong> (for delivery coordination)
  </p>
</div>
<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b45309;margin-bottom:13px;">Please Note</div>
  <ol style="margin:0;padding-left:20px;color:#78350f;font-size:13.5px;line-height:1.75;">
    <li style="margin-bottom:8px;">Ensure the PIN code is correct to avoid any delays or misrouting of your package.</li>
    <li style="margin-bottom:8px;">Study material will be dispatched within 3–5 working days of receiving your confirmed address.</li>
    <li>You will receive a tracking number via email and SMS once the package is dispatched.</li>
  </ol>
</div>
<p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.8;">Please reply to this email with your address details at the earliest so we can get everything ready for dispatch without delay.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "bank_details",
    name: "Bank details only",
    description: "Share selected bank details without fee summary.",
    sortOrder: 28,
    subject: "Bank & Account Details For {{targetExams}} Course - TestprepKart",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Payment Information",
      badge: "Payment Details",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">We are pleased to share our bank details to facilitate the course fee payment for {{studentName}}'s NEET Preparation Programme. Please use the account information below to complete your transfer.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #475569;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#475569;margin-bottom:16px;">Bank & Account Details</div>
  {{feeBankDetailsHtml}}
</div>
<div style="background:#fff7f7;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b91c1c;margin-bottom:10px;">⚠ Important – Tax Advisory</div>
  <p style="font-size:13.5px;color:#7f1d1d;line-height:1.75;margin:0 0 10px;">To avoid an additional 18% GST on your course fee, we strongly recommend making the payment via one of the following methods:</p>
  <p style="font-size:13.5px;color:#7f1d1d;line-height:1.8;margin:0 0 10px;">✅ <strong>NRE Account</strong> (Non-Resident External)<br/>✅ <strong>Wire Transfer</strong> (international bank transfer)<br/>✅ <strong>Remittance Aggregators</strong> — e.g., Remitly, Wise, Western Union</p>
  <p style="font-size:13.5px;color:#7f1d1d;line-height:1.75;margin:0;">Please note that payments made through an <strong>NRO (Non-Resident Ordinary) account</strong> are subject to an additional 18% tax on the course fee as per current regulations.</p>
</div>
<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b45309;margin-bottom:13px;">After Making the Payment</div>
  <ol style="margin:0;padding-left:20px;color:#78350f;font-size:13.5px;line-height:1.75;">
    <li style="margin-bottom:8px;">Please reply to this email with a screenshot or reference number of the transaction so our team can confirm receipt promptly.</li>
    <li>An official payment receipt will be issued and sent to you within 24–48 hours of confirmation.</li>
  </ol>
</div>
<p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.8;">For any assistance with the payment process, please contact us — we are here to make this as smooth as possible for you.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "fees",
    name: "Fee structure",
    description: "Fee, installments, and bank details for payment.",
    sortOrder: 30,
    subject: "Course Fee Details For {{targetExams}} For {{studentName}}",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Fee Structure",
      badge: "Fee Details",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">As discussed with our Course Counsellor, please find below the complete fee structure for {{studentName}}'s NEET Preparation Programme. We have provided a detailed breakdown to ensure full transparency.</p>
<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #475569;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#475569;margin-bottom:16px;">Course Fee Breakdown</div>
  {{feeSummaryHtml}}
</div>
<div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:16px;">Flexible Payment Options</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;width:160px;color:#64748b;font-size:13.5px;">💳 Full Payment</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Pay in full & receive a special discount</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#64748b;font-size:13.5px;">📅 Instalment Plan</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Flexible instalments — details shared on request</td></tr>
    <tr><td style="padding:9px 0;color:#64748b;font-size:13.5px;">🏦 Payment Mode</td><td style="padding:9px 0;color:#0f2a4a;font-size:13.5px;font-weight:600;">Wire transfer, NRE account, or remittance aggregators</td></tr>
  </table>
</div>
<div style="background:#fff7f7;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b91c1c;margin-bottom:10px;">⚠ Important – Tax Advisory</div>
  <p style="font-size:13.5px;color:#7f1d1d;line-height:1.75;margin:0 0 10px;">To avoid an additional 18% GST, we strongly recommend paying via <strong>NRE Account, Wire Transfer,</strong> or remittance platforms such as <strong>Remitly or Wise.</strong></p>
  <p style="font-size:13.5px;color:#7f1d1d;line-height:1.75;margin:0;">Payments made through an <strong>NRO account</strong> attract an additional 18% tax as per Indian regulations. Please plan accordingly.</p>
</div>
{{feeBankDetailsHtml}}
<p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.8;">Should you have any questions about the fee structure, payment plans, or any other aspect of the programme, please reach out — we are always happy to help.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "enrollment",
    name: "Enrollment form",
    description: "Link to complete enrollment.",
    sortOrder: 40,
    subject: "Enrollment Form Link For {{targetExams}} Course",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Enrolment Form",
      badge: "Action Required",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">We are delighted to take the next step together! To formally begin {{studentName}}'s journey with our NEET Preparation Programme, we kindly request you to complete the Enrolment Form using the link below.</p>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">This is an important step that helps us personalise {{studentName}}'s learning plan, assign the right faculty, and get everything in place before the course begins.</p>
<div style="text-align:center;margin:26px 0 6px;">
  <a href="{{enrollmentLink}}" style="display:inline-block;background:#0f2a4a;color:#ffffff !important;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.4px;padding:14px 44px;border-radius:8px;box-shadow:0 4px 14px rgba(15,42,74,0.22);">Submit Enrolment Form</a>
</div>
<p style="text-align:center;font-size:11.5px;color:#94a3b8;margin:9px 0 0;">The form takes approximately 5–7 minutes to complete.</p>
<div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:22px 26px;margin:24px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:16px;">What to Keep Ready</div>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;width:160px;color:#64748b;font-size:13.5px;">🎓 Academic</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">{{studentName}}'s current class and recent exam scores</td></tr>
    <tr><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#64748b;font-size:13.5px;">📍 Address</td><td style="padding:9px 0;border-bottom:1px solid #e8f0fc;color:#0f2a4a;font-size:13.5px;font-weight:600;">Complete residential address with PIN code</td></tr>
    <tr><td style="padding:9px 0;color:#64748b;font-size:13.5px;">📱 Contact</td><td style="padding:9px 0;color:#0f2a4a;font-size:13.5px;font-weight:600;">Parent and student phone numbers & email IDs</td></tr>
  </table>
</div>
<div style="background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:10px;padding:20px 24px;margin:24px 0 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b45309;margin-bottom:13px;">What Happens Next</div>
  <ol style="margin:0;padding-left:20px;color:#78350f;font-size:13.5px;line-height:1.75;">
    <li style="margin-bottom:8px;">Once the form is submitted, our team will review the details and confirm {{studentName}}'s enrolment within 24 hours.</li>
    <li style="margin-bottom:8px;">Course fee details and payment instructions will be shared with you separately by our counsellor.</li>
    <li>Study material will be dispatched to your address once the enrolment process is fully complete.</li>
  </ol>
</div>
<p style="margin:24px 0 0;font-size:14px;color:#475569;line-height:1.8;">If you face any difficulty with the form or need assistance, please do not hesitate to contact us — we are happy to guide you through each step.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
  {
    key: "schedule",
    name: "Class schedule",
    description: "Weekly class schedule.",
    sortOrder: 50,
    subject: "Class schedule - {{studentName}}",
    bodyHtml: emailShell({
      preHeader: "Academic Enrolments · Class Schedule",
      badge: "Schedule Shared",
      body: `<p style="font-size:14.5px;color:#475569;line-height:1.6;margin:0 0 2px;">Dear <strong style="color:#0f2a4a;">{{recipientGreeting}}</strong>,</p>
<div style="width:100%;height:1px;background:#e8edf4;margin:20px 0;"></div>
<p style="font-size:14.5px;line-height:1.8;color:#475569;margin:0 0 14px;">Please find the weekly class schedule for {{studentName}} below.</p>
<div style="background:#f7faff;border:1px solid #dbeafe;border-left:4px solid #2563eb;border-radius:10px;padding:20px 24px;margin:22px 0;">
  <div style="font-size:10.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#2563eb;margin-bottom:12px;">Schedule Details</div>
  <pre style="margin:0;font-family:inherit;white-space:pre-wrap;font-size:13.5px;line-height:1.75;color:#0f2a4a;">{{scheduleSummary}}</pre>
</div>
<p style="margin:20px 0 0;font-size:14px;color:#475569;line-height:1.8;">If you need any change in timings or have questions, please reply to this email and our counsellor will assist you.</p>
<div style="margin-top:14px;">
  <div style="font-size:13.5px;color:#64748b;"><strong style="display:block;font-size:14px;color:#0f2a4a;">Warm regards,</strong>Enrolments Team</div>
</div>`,
    }),
  },
];
