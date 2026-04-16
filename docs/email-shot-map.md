# Email Shot Map (When + Why + How Many)

This is a deep map of all email-shot related flows in the current codebase.

## Quick count

- **Template keys defined:** `9`
  - `demo_invite`
  - `demo_status_update`
  - `brochure`
  - `courier_address`
  - `bank_details`
  - `fees`
  - `enrollment`
  - `fees_enrollment_bundle` (composite, not its own DB row)
  - `schedule`
- **Default DB template rows seeded:** `8`
  - All above except `fees_enrollment_bundle` (composite only)
- **Additional non-template mail flows:** `2`
  - Teacher feedback invite email
  - Enrollment/internal notification after teacher submits feedback

## Mail shots by template key

## 1) `demo_invite`

- **When:** Staff clicks "Confirm Demo & Send Link" in Demo step.
- **Why:** Confirm scheduled demo details and share join link.
- **Recipients:**
  - Parent/student email (lead email)
  - Faculty email (separate faculty-specific UI email)
  - Enrollment team in BCC (if `ENROLLMENT_TEAM_BCC` configured)
- **Trigger path:** `DemoStepPanel` -> `POST /api/leads/[id]/send-email` with `templateKey: "demo_invite"` -> `sendDemoInviteMail`.
- **Core files:**
  - `src/components/student/pipeline/DemoStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/sendDemoInviteMail.ts`
  - `src/lib/email/defaultEmailTemplates.ts`

## 2) `demo_status_update`

- **When:** Demo row status changes to Scheduled / Completed / Cancelled.
- **Why:** Notify family and optionally faculty about status updates.
- **Recipients:**
  - Parent/student (if `notifyParent`)
  - Faculty (if `notifyFaculty` and faculty email exists)
- **Trigger path:** `DemoStepPanel` status change -> `sendLeadPipelineEmail(... demoStatusEmail ...)`.
- **Core files:**
  - `src/components/student/pipeline/DemoStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/buildLeadEmailVars.ts`
  - `src/lib/email/defaultEmailTemplates.ts`

## 3) `brochure`

- **When:**
  - Step 2 documents: selected brochure bundle send
  - Student report modal: send generated/uploaded report (report-only mode)
- **Why:** Send course brochure documents and/or report PDF.
- **Recipients:**
  - Parent/student email
  - Enrollment team in BCC (if configured)
- **Trigger path:**
  - `DocumentsStepPanel` -> `sendLeadPipelineEmail(... brochureEmail ...)`
  - `StudentReportModal` -> `sendLeadPipelineEmail(... brochureEmail includeStudentReportPdf=true ...)`
- **Core files:**
  - `src/components/student/pipeline/DocumentsStepPanel.tsx`
  - `src/components/student/StudentReportModal.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/buildBrochureBundleEmailVars.ts`

## 4) `courier_address`

- **When:** Step 2 user clicks send for courier address request.
- **Why:** Collect shipping address for physical document dispatch.
- **Recipients:** Parent/student email.
- **Trigger path:** `DocumentsStepPanel` -> `sendLeadPipelineEmail(... templateKey: "courier_address")`.
- **Core files:**
  - `src/components/student/pipeline/DocumentsStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/defaultEmailTemplates.ts`

## 5) `bank_details`

- **When:** Step 2 user selects bank account and sends bank details.
- **Why:** Share payment account details only.
- **Recipients:**
  - Parent/student email
  - Enrollment team in BCC (if configured)
- **Trigger path:** `DocumentsStepPanel` -> `sendLeadPipelineEmail(... templateKey: "bank_details")`.
- **Core files:**
  - `src/components/student/pipeline/DocumentsStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/feeBankDetailsForEmail.ts`

## 6) `fees`

- **When:** Step 3 user clicks "Email fee plan to parent".
- **Why:** Send fee summary + selected bank details.
- **Recipients:**
  - Parent/student email
  - Enrollment team in BCC (if configured)
- **Trigger path:** `FeesStepPanel` -> `sendLeadPipelineEmail(... templateKey: "fees")`.
- **Core files:**
  - `src/components/student/pipeline/FeesStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/feeBankDetailsForEmail.ts`

## 7) `enrollment`

- **When:** Step 2 user sends enrollment form link.
- **Why:** Ask family to complete enrollment form.
- **Recipients:** Parent/student email.
- **Trigger path:** `DocumentsStepPanel` -> `sendLeadPipelineEmail(... templateKey: "enrollment")`.
- **Core files:**
  - `src/components/student/pipeline/DocumentsStepPanel.tsx`
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/enrollmentFormLink.ts`

## 8) `fees_enrollment_bundle` (composite)

- **When:** API call with `templateKey: "fees_enrollment_bundle"` (designed for combined Step 3 send).
- **Why:** One email that merges fee + enrollment sections.
- **Recipients:**
  - Parent/student email
  - Enrollment team in BCC (if configured)
- **Trigger path:** `POST /api/leads/[id]/send-email` -> `sendFeesEnrollmentBundleEmail`.
- **Core files:**
  - `src/app/api/leads/[id]/send-email/route.ts`
  - `src/lib/email/sendFeesEnrollmentBundle.ts`
- **Note:** Composite mail, not a standalone template row in DB.

## 9) `schedule`

- **When:** Template exists and can send through generic send-email API.
- **Why:** Share class schedule summary.
- **Recipients:** Parent/student email.
- **Trigger path:** Generic route supports it.
- **Core files:**
  - `src/lib/email/templateKeys.ts`
  - `src/lib/email/defaultEmailTemplates.ts`
  - `src/app/api/leads/[id]/send-email/route.ts`
- **Note:** No dedicated current UI trigger was found in student panels.

## Non-template email flows

## A) Teacher feedback invite email

- **When:** In Demo step, send/resend feedback OR auto-send after configured delay from demo start.
- **Why:** Collect teacher feedback via one-time token link.
- **Recipients:**
  - Teacher email (resolved from faculty name)
  - Enrollment team in BCC (if configured)
- **Core files:**
  - `src/app/api/leads/[id]/demo-feedback/route.ts`
  - `src/components/student/pipeline/DemoStepPanel.tsx`

## B) Enrollment/internal notify on feedback submission

- **When:** Teacher submits feedback form (`/api/demo-feedback/[token]`).
- **Why:** Alert enrollment team that feedback is submitted.
- **Recipients:**
  - Teacher email as primary if resolvable, else enrollment list as primary
  - Enrollment team BCC when teacher primary is used
- **Core files:**
  - `src/app/api/demo-feedback/[token]/route.ts`
  - `src/lib/email/teacherFeedbackEmails.ts`

## Notes on current UI vs your `emailTemplete` folder

- Your project folder has additional HTML designs like:
  - `email2_session_feedback.html`
  - `email6_medical_colleges.html`
- In current app logic:
  - Session feedback concept is handled through **teacher feedback flows** (token email + submission notification), not as a separate editable template key.
  - "Current Ranking & Top Medical Colleges" appears in Step 2 table as a row, but currently behaves as a manual "mark sent" status flow (no dedicated email send route/template key found).

## Central API entry points

- Template management (load/save/restore defaults):
  - `src/app/api/email-templates/route.ts`
- Sending lead pipeline emails:
  - `src/app/api/leads/[id]/send-email/route.ts`
- Teacher feedback email + token flows:
  - `src/app/api/leads/[id]/demo-feedback/route.ts`
  - `src/app/api/demo-feedback/[token]/route.ts`

