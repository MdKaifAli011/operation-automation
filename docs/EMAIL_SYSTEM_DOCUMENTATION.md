# Email System Documentation

## Overview

This document provides comprehensive details about all email-related functionality in the operation-automation CRM system. It covers email templates, triggers, API routes, sending logic, and configuration.

---

## Email Templates

The system supports **9 email templates** defined in `src/lib/email/templateKeys.ts`:

### 1. demo_invite
- **Purpose**: Sent when staff taps "Share → Send link" on a demo row
- **Recipients**: 
  - Primary: Student/Parent (To)
  - CC: Faculty (when listed on the demo)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in DemoStepPanel (sendDemoInviteEmail function)
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, country, grade, targetExams, sessionDate, sessionTime, subject, facultyName, duration, sessionLink, demoSummary, meetLink
- **Special Features**: 
  - Faculty receives a separate dedicated email
  - Enrollment team BCC when configured
  - Uses demo row data for date, time, subject, faculty, duration, session link

### 2. demo_status_update
- **Purpose**: Automatic email when demo status changes to Scheduled, Completed, or Cancelled
- **Recipients**: 
  - Primary: Student/Parent (To) when notifyParent is true
  - CC: Faculty (when notifyFaculty is true and faculty email exists)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Automatic on demo status change in DemoStepPanel (requestStatusChangeWithConfirm function)
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, country, grade, targetExams, demoStatus, demoStatusLabel, demoSummary, meetLink, demoStatusEmailSubject, demoStatusEmailBodyHtml, demoStatusMeetSectionHtml
- **Special Features**: 
  - Meeting links appear only for scheduled rows
  - Parent-friendly copy
  - Separate emails to parent and faculty

### 3. brochure
- **Purpose**: Send course brochures and/or student report PDF
- **Recipients**: 
  - Primary: Student/Parent (To)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in DocumentsStepPanel or StudentReportModal
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, country, grade, targetExams, brochureLabel, brochureLink, brochureBundleHtml
- **Special Features**: 
  - Can include multiple catalog brochures (by target exam)
  - Can include student report PDF
  - If only report PDF is sent, subject becomes "Demo Session Report - StudentName"
  - BCC enrollment team when configured

### 4. courier_address
- **Purpose**: Request shipping details for document dispatch
- **Recipients**: Student/Parent (To)
- **Trigger**: Manual action in DocumentsStepPanel
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, country, grade, targetExams
- **Special Features**: None

### 5. bank_details
- **Purpose**: Share bank account details for payment/transfer queries (no fee summary)
- **Recipients**: 
  - Primary: Student/Parent (To)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in DocumentsStepPanel
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, country, grade, targetExams, feeBankDetailsHtml
- **Special Features**: 
  - No fee summary included
  - Bank account follows lead's selection or institute default
  - If {{feeBankDetailsHtml}} is missing, app appends bank details automatically
  - BCC enrollment team when configured

### 6. fees
- **Purpose**: Send fee structure with final fee, scholarship, installments, and bank account
- **Recipients**: 
  - Primary: Student/Parent (To)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in FeesStepPanel
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, feeFinal, feeCurrency, feeSummary, feeSummaryHtml, feeBankDetailsHtml
- **Special Features**: 
  - Bank account follows lead's selection or institute default
  - If {{feeBankDetailsHtml}} is missing, app appends bank details automatically
  - BCC enrollment team when configured

### 7. enrollment
- **Purpose**: Send enrollment form link
- **Recipients**: 
  - Primary: Student/Parent (To)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in DocumentsStepPanel
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, enrollmentLink
- **Special Features**: 
  - {{enrollmentLink}} set by ENROLLMENT_FORM_LINK / ENROLLMENT_FORM_URL
  - Same body for student and BCC recipients
  - Relative paths resolved with app URL

### 8. fees_enrollment_bundle
- **Purpose**: Combined fee + enrollment in one email (not a separate DB row)
- **Recipients**: 
  - Primary: Student/Parent (To)
  - BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)
- **Trigger**: Manual action in FeesStepPanel ("Send fee + enrollment" button)
- **Placeholders**: (Edit Fee structure + Enrollment form templates - combined at send time)
- **Special Features**: 
  - Builds one email from Fee + Enrollment templates
  - BCC enrollment team via ENROLLMENT_TEAM_BCC
  - No separate HTML template

### 9. schedule
- **Purpose**: Send weekly class schedule
- **Recipients**: Student/Parent (To)
- **Trigger**: Manual action in ScheduleStepPanel
- **Placeholders**: studentName, parentName, recipientGreeting, logoUrl, email, phone, scheduleSummary
- **Special Features**: 
  - Can attach schedule PDF
  - Uses classes saved on the lead

---

## Email API Routes

### POST `/api/leads/[id]/send-email`
**Location**: `src/app/api/leads/[id]/send-email/route.ts`

**Purpose**: Main email sending endpoint for all template-based emails

**Request Body**:
```typescript
{
  templateKey?: string; // Required: one of the 9 template keys
  demoRowIndex?: number; // For demo-related emails
  meetRowId?: string; // Stable row id for demo_invite (preferred over demoRowIndex)
  demoStatusEmail?: {
    status: "Scheduled" | "Completed" | "Cancelled";
    row?: Record<string, unknown>;
    notifyParent?: boolean;
    notifyFaculty?: boolean;
  };
  brochureEmail?: {
    selectionKeys: string[];
    includeStudentReportPdf: boolean;
    studentReportPdfUrls?: string[];
  };
  scheduleEmail?: {
    attachSchedulePdf?: boolean;
  };
}
```

**Template Handling**:

1. **demo_invite**: 
   - Finds demo row by meetRowId or demoRowIndex
   - Calls sendDemoInviteMailSafe
   - Persists invite on lead
   - Logs demo invite email

2. **demo_status_update**:
   - Validates status (Scheduled/Completed/Cancelled)
   - Checks notifyParent and notifyFaculty flags
   - Sends separate emails to parent and faculty
   - Uses row snapshot for accurate data

3. **fees_enrollment_bundle**:
   - Combines fee and enrollment templates
   - Sends one email with both sections
   - BCC enrollment team

4. **brochure**:
   - Handles brochure selection and student report PDF
   - Special case for report-only email (custom subject)
   - BCC enrollment team

5. **fees** or **bank_details**:
   - Merges fee email vars with bank details
   - BCC enrollment team

6. **schedule**:
   - Attaches schedule PDF if requested
   - Validates PDF path

**Response**: `{ ok: true }` or error object

---

### POST `/api/leads/[id]/demo-feedback`
**Location**: `src/app/api/leads/[id]/demo-feedback/route.ts`

**Purpose**: Send teacher feedback form link to faculty

**Request Body**:
```typescript
{
  meetRowId: string; // Required
  sendEmail?: boolean; // true to email teacher
  linkOnly?: boolean; // true to get link without emailing
}
```

**Validation**:
- Demo row must exist
- Demo cannot be Cancelled
- Feedback must not already be submitted
- If sending email, must be at least 45 minutes after demo start

**Process**:
1. Creates or reuses feedback token
2. Generates feedback URL: `{baseUrl}/feedback/demo/{token}`
3. If sendEmail: sends email to teacher
4. If linkOnly: returns URL only
5. Logs feedback invite sent

**Recipients**:
- Primary: Faculty (To)
- BCC: Enrollment team (when `ENROLLMENT_TEAM_BCC` is configured)

**Response**:
```typescript
{
  ok: true;
  feedbackUrl: string;
  emailSent: boolean;
  emailSkippedReason: string | null;
}
```

---

## Email Triggers in Components

### DemoStepPanel (`src/components/student/pipeline/DemoStepPanel.tsx`)

#### 1. sendDemoInviteEmail
- **Trigger**: User clicks "Send link" or "Resend link" on demo row
- **Function**: Opens confirmation modal, then calls API
- **Email**: demo_invite
- **Recipients**: Student/Parent + Faculty (CC) + Enrollment team (BCC)

#### 2. sendTeacherFeedback
- **Trigger**: User clicks "Send feedback" or "Resend feedback" button
- **Validation**: 
  - Checks if demo is Cancelled or Rescheduled (blocks sending)
  - Checks if 45 minutes have passed since demo start
- **Email**: Teacher feedback form link
- **Recipients**: Faculty (To) + Enrollment team (BCC)

#### 3. requestStatusChangeWithConfirm (demo_status_update)
- **Trigger**: User changes demo status to Scheduled/Completed/Cancelled
- **Function**: Opens confirmation dialog with notifyParent/notifyFaculty checkboxes
- **Email**: demo_status_update
- **Recipients**: 
  - Parent (To) if notifyParent checked
  - Faculty (To) if notifyFaculty checked
  - Enrollment team (BCC) when configured

---

### DocumentsStepPanel (`src/components/student/pipeline/DocumentsStepPanel.tsx`)

#### 1. sendEnrollmentEmail
- **Trigger**: User clicks "Send enrollment form" button
- **Email**: enrollment
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

#### 2. sendCourierAddressEmail
- **Trigger**: User clicks "Request courier address" button
- **Email**: courier_address
- **Recipients**: Student/Parent (To)

#### 3. sendBrochureEmail
- **Trigger**: User clicks "Send brochure" button with selected brochures
- **Email**: brochure
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

#### 4. sendBankDetailsEmail
- **Trigger**: User clicks "Send bank details" button
- **Email**: bank_details
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

---

### FeesStepPanel (`src/components/student/pipeline/FeesStepPanel.tsx`)

#### 1. sendFeeEmail
- **Trigger**: User clicks "Send fee structure" button
- **Email**: fees
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

#### 2. sendFeeEnrollmentBundleEmail
- **Trigger**: User clicks "Send fee + enrollment" button
- **Email**: fees_enrollment_bundle (combines fee + enrollment templates)
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

---

### ScheduleStepPanel (`src/components/student/pipeline/ScheduleStepPanel.tsx`)

#### 1. sendScheduleEmail
- **Trigger**: User clicks "Email schedule" button
- **Email**: schedule
- **Recipients**: Student/Parent (To)
- **Attachments**: Schedule PDF (if attachSchedulePdf is true)

---

### StudentReportModal (`src/components/student/StudentReportModal.tsx`)

#### 1. sendReportEmail
- **Trigger**: User clicks "Send report" button
- **Email**: brochure (with student report PDF)
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

---

### StudentReportVersionsModal (`src/components/student/StudentReportVersionsModal.tsx`)

#### 1. sendReportEmail
- **Trigger**: User clicks "Send report" button
- **Email**: brochure (with student report PDF)
- **Recipients**: Student/Parent (To) + Enrollment team (BCC)

---

## Email Library Functions

### Core Email Sending

#### sendMail (`src/lib/email/sendMail.ts`)
- **Purpose**: Core email sending function using Nodemailer
- **Features**:
  - Supports To, CC, BCC
  - Supports attachments
  - Reply-to configuration via MAIL_REPLY_TO
  - HTML to plain text fallback
  - Logging for debugging
- **Configuration**: Uses SMTP settings from environment variables

---

### Template-Specific Functions

#### sendDemoInviteMailSafe (`src/lib/email/sendDemoInviteMail.ts`)
- **Purpose**: Send demo invite email with faculty CC and enrollment BCC
- **Features**:
  - Sends separate email to faculty
  - BCC enrollment team
  - Logs email details
  - Handles teacher email resolution
  - Persist invite on lead if requested

#### sendFeesEnrollmentBundleEmail (`src/lib/email/sendFeesEnrollmentBundle.ts`)
- **Purpose**: Send combined fee + enrollment email
- **Features**:
  - Merges fee and enrollment templates
  - BCC enrollment team
  - Separate email to enrollment team with different greeting

#### sendTeacherFeedbackNotificationEmail (`src/lib/email/teacherFeedbackEmails.ts`)
- **Purpose**: Notify enrollment team when teacher submits feedback via public form
- **Features**:
  - Sends to enrollment team BCC
  - No-op if mail not configured or no enrollment addresses

---

### Template Rendering

#### renderTemplate (`src/lib/email/renderTemplate.ts`)
- **Purpose**: Render template with variables using Handlebars-like syntax
- **Syntax**: `{{variableName}}`

#### buildLeadEmailVars (`src/lib/email/buildLeadEmailVars.ts`)
- **Purpose**: Build email variables from lead data
- **Features**:
  - Handles different recipient types (parent_or_student, faculty, enrollment_team)
  - Context-aware variable building

#### buildBrochureBundleEmailVars (`src/lib/email/buildBrochureBundleEmailVars.ts`)
- **Purpose**: Build variables for brochure emails with attachments
- **Features**:
  - Handles brochure selection
  - Handles student report PDF inclusion
  - Generates brochure bundle HTML

#### mergeFeeEmailVarsWithBankDetails (`src/lib/email/feeBankDetailsForEmail.ts`)
- **Purpose**: Merge fee email variables with bank account details
- **Features**:
  - Formats bank account HTML
  - Uses lead's selected bank or institute default

---

### Recipient Management

#### getEnrollmentTeamBccEmails (`src/lib/email/enrollmentRecipients.ts`)
- **Purpose**: Get enrollment team email addresses for BCC
- **Environment Variables**: ENROLLMENT_TEAM_BCC or MAIL_ENROLLMENT_BCC
- **Format**: Comma, semicolon, or newline separated

#### normalizeMailRecipients (`src/lib/email/mailRecipients.ts`)
- **Purpose**: Dedupe BCC against To/CC to avoid duplicate addresses
- **Features**: Ensures no email is repeated

#### resolveTeacherEmailFromFacultyName (`src/lib/faculty/resolveTeacherEmail.ts`)
- **Purpose**: Resolve teacher email from faculty name
- **Features**: Looks up faculty record by name and returns email

---

### Configuration

#### getAppBaseUrl (`src/lib/email/appBaseUrl.ts`)
- **Purpose**: Get application base URL for links in emails
- **Environment Variable**: NEXT_PUBLIC_APP_URL
- **Fallback**: Constructs from request headers

#### getEnrollmentFormLink (`src/lib/email/enrollmentFormLink.ts`)
- **Purpose**: Get enrollment form URL for {{enrollmentLink}} placeholder
- **Environment Variables**: ENROLLMENT_FORM_LINK, ENROLLMENT_FORM_URL, NEXT_PUBLIC_APP_URL
- **Fallback**: /enroll-student

#### isMailConfigured (`src/lib/email/sendMail.ts`)
- **Purpose**: Check if email is configured
- **Environment Variables**: SMTP_HOST, SMTP_USER, SMTP_PASS

---

## Environment Variables

### Email Configuration

| Variable | Purpose | Required |
|----------|---------|----------|
| `SMTP_HOST` | SMTP server hostname | Yes |
| `SMTP_PORT` | SMTP server port | Yes |
| `SMTP_USER` | SMTP username | Yes |
| `SMTP_PASS` | SMTP password | Yes |
| `MAIL_FROM` | Default from email address | Yes |
| `MAIL_REPLY_TO` | Reply-to email address | No |

### Enrollment Configuration

| Variable | Purpose | Used By |
|----------|---------|---------|
| `ENROLLMENT_TEAM_BCC` | Enrollment team email addresses for BCC | demo_invite, demo_status_update, brochure, fees, bank_details, fees_enrollment_bundle, demo_feedback |
| `MAIL_ENROLLMENT_BCC` | Alternative to ENROLLMENT_TEAM_BCC | Same as above |

### Link Configuration

| Variable | Purpose | Used By |
|----------|---------|---------|
| `ENROLLMENT_FORM_LINK` | Enrollment form URL | enrollment, fees_enrollment_bundle |
| `ENROLLMENT_FORM_URL` | Alternative to ENROLLMENT_FORM_LINK | Same as above |
| `NEXT_PUBLIC_APP_URL` | Application base URL | All emails with links |

---

## BCC/CC Rules

### Enrollment Team BCC

The following emails BCC the enrollment team when `ENROLLMENT_TEAM_BCC` is configured:

1. **demo_invite**: When sending demo invite to student
2. **demo_status_update**: When sending status update to parent/faculty
3. **brochure**: When sending brochure/documents
4. **fees**: When sending fee structure
5. **bank_details**: When sending bank details only
6. **fees_enrollment_bundle**: When sending combined fee + enrollment
7. **demo_feedback**: When sending teacher feedback link

### Faculty CC

The following emails CC the faculty:

1. **demo_invite**: Faculty receives separate dedicated email
2. **demo_status_update**: When notifyFaculty is true

### Recipient Deduplication

The system automatically deduplicates email addresses:
- BCC addresses are deduped against To and CC
- No email address receives the same email twice

---

## Email Logging

### Demo Invite Logging (`src/lib/email/demoInviteLog.ts`)

**Purpose**: Log demo invite email details for debugging

**Logged Information**:
- Timestamp
- Lead ID
- Meet Row ID
- To, CC, BCC addresses
- Source (auto_assign vs manual_send)
- Event (sent, skip, error)
- Error message if applicable

**Storage**: Console logs (can be extended to database)

---

## Email Validation Rules

### Demo Feedback Email Validation

1. **45-minute rule**: Feedback email can only be sent at least 45 minutes after demo start
   - Configurable via `getDemoTeacherFeedbackAfterMinutes()`
   - Returns error if not eligible

2. **Status check**: Feedback cannot be sent for cancelled demos
   - Returns error with code "cancelled"

3. **Submission check**: Feedback cannot be sent if already submitted
   - Returns error with code "submitted"

4. **Teacher email check**: Requires teacher email on faculty record
   - Skips email if not found (returns link only)

---

## Email Template Variables

### Common Variables (Available in Most Templates)

- `{{studentName}}` - Student's full name
- `{{parentName}}` - Parent's name
- `{{recipientGreeting}}` - Greeting for recipient (Dear [Name])
- `{{logoUrl}}` - Institute logo URL
- `{{email}}` - Recipient email
- `{{phone}}` - Phone number
- `{{country}}` - Country
- `{{grade}}` - Student's grade/class
- `{{targetExams}}` - Target exams (e.g., NEET, JEE)

### Demo-Specific Variables

- `{{sessionDate}}` - Demo date
- `{{sessionTime}}` - Demo time
- `{{subject}}` - Demo subject
- `{{facultyName}}` - Faculty name
- `{{duration}}` - Demo duration
- `{{sessionLink}}` - Demo join link
- `{{meetLink}}` - Same as sessionLink
- `{{demoSummary}}` - One-line demo summary
- `{{demoStatus}}` - Demo status (Scheduled/Completed/Cancelled)
- `{{demoStatusLabel}}` - Short status label
- `{{demoStatusEmailSubject}}` - Full subject line
- `{{demoStatusEmailBodyHtml}}` - Email body HTML
- `{{demoStatusMeetSectionHtml}}` - Meet link section HTML

### Fee-Specific Variables

- `{{feeFinal}}` - Final fee amount
- `{{feeCurrency}}` - Currency (e.g., INR, USD)
- `{{feeSummary}}` - Plain text fee summary
- `{{feeSummaryHtml}}` - Styled fee summary HTML
- `{{feeBankDetailsHtml}}` - Bank account details HTML

### Brochure-Specific Variables

- `{{brochureLabel}}` - First brochure label
- `{{brochureLink}}` - First brochure URL
- `{{brochureBundleHtml}}` - Styled bundle of all selected documents

### Schedule-Specific Variables

- `{{scheduleSummary}}` - Weekly schedule summary

### Enrollment-Specific Variables

- `{{enrollmentLink}}` - Enrollment form URL

---

## Email Sending Flow

### Standard Email Flow

```
User Action in UI
    ↓
Component Function (e.g., sendDemoInviteEmail)
    ↓
sendLeadPipelineEmail (client utility)
    ↓
POST /api/leads/[id]/send-email
    ↓
Template Validation & Variable Building
    ↓
Template Rendering
    ↓
sendMail (Nodemailer)
    ↓
Email Sent
```

### Demo Invite Flow

```
User clicks "Send link"
    ↓
Confirmation Modal
    ↓
sendDemoInviteEmail
    ↓
POST /api/leads/[id]/send-email (templateKey: demo_invite)
    ↓
sendDemoInviteMailSafe
    ↓
Send to Student (To)
    ↓
Send to Faculty (CC) - separate email
    ↓
Send to Enrollment Team (BCC) - separate email
    ↓
Log Email Details
    ↓
Persist Invite on Lead
```

### Demo Status Update Flow

```
User changes demo status
    ↓
Confirmation Dialog (notifyParent/notifyFaculty checkboxes)
    ↓
requestStatusChangeWithConfirm
    ↓
POST /api/leads/[id]/send-email (templateKey: demo_status_update)
    ↓
Validate Status
    ↓
If notifyParent: Send to Parent (To)
    ↓
If notifyFaculty: Send to Faculty (To)
    ↓
Send to Enrollment Team (BCC) - if configured
```

---

## Error Handling

### Common Email Errors

1. **Template Not Found**
   - Error: "Template not found. Open Email templates to create or restore templates."
   - Cause: Template missing from database
   - Solution: Seed default templates or create template in Email Templates page

2. **Template Disabled**
   - Error: "This template is disabled. Enable it under Email Templates Management."
   - Cause: Template.enabled = false in database
   - Solution: Enable template in Email Templates page

3. **No Email Address**
   - Error: "This lead has no email address. Add one on the lead first."
   - Cause: lead.email is missing
   - Solution: Add email to lead

4. **Parent Email Missing** (demo_status_update)
   - Error: "Parent/student email is missing for this lead. Add parent email id first."
   - Cause: lead.parentEmail or lead.email is missing
   - Solution: Add parent email to lead

5. **Faculty Email Missing** (demo_status_update)
   - Error: "Faculty email is missing on the selected teacher record."
   - Cause: Faculty record has no email
   - Solution: Add email to faculty record

6. **Teacher Email Missing** (demo_feedback)
   - Skipped: "No email found for this teacher on the Faculties record. You can still copy the link below."
   - Cause: Faculty record has no email
   - Solution: Add email to faculty record (non-blocking)

7. **Feedback Not Eligible** (demo_feedback)
   - Error: "Feedback email can only be sent at least 45 minutes after the demo start."
   - Cause: Less than 45 minutes since demo start
   - Solution: Wait until 45 minutes after demo start

8. **Feedback Already Submitted** (demo_feedback)
   - Error: "Feedback was already submitted for this demo."
   - Cause: teacherFeedbackSubmittedAt is set
   - Solution: Cannot resend (link already used)

9. **Demo Cancelled** (demo_feedback)
   - Error: "Feedback is not available for a cancelled demo."
   - Cause: Demo status is Cancelled
   - Solution: Cannot send feedback for cancelled demos

---

## Email Template Management

### Email Templates Page

**Location**: `/email-templates` (src/app/(dashboard)/email-templates/page.tsx)

**Features**:
- View all 9 email templates
- Edit template subject and body HTML
- Live preview with sample variables
- Enable/disable templates
- Reset to default template
- View placeholder documentation
- SMTP configuration section

### Default Templates

**Location**: `src/lib/email/defaultEmailTemplates.ts`

**Features**:
- Professional email design with branded header/footer
- Responsive layout
- Placeholder variables
- Consistent styling across all templates

### Template Seeding

**Function**: `ensureDefaultTemplates()` (src/lib/email/ensureDefaultTemplates.ts)

**Purpose**: Ensure default templates exist in database

**Trigger**: Called on email send if templates are missing

---

## Security Considerations

1. **Email Configuration**: SMTP credentials stored in environment variables
2. **Reply-To**: MAIL_REPLY_TO prevents direct replies to system email
3. **BCC Deduplication**: Prevents email address exposure
4. **Token-Based Feedback**: Demo feedback uses secure tokens
5. **Input Validation**: All email inputs validated before sending
6. **HTML Escaping**: Variables are HTML-escaped to prevent XSS
7. **Path Validation**: File attachments validated to prevent directory traversal

---

## Performance Considerations

1. **Async Operations**: All email sends are async
2. **Error Handling**: Graceful error handling with user feedback
3. **Logging**: Comprehensive logging for debugging
4. **Rate Limiting**: Consider implementing rate limiting for email sends
5. **Queue System**: Consider implementing email queue for high volume

---

## Future Enhancements

1. **Email Queue**: Implement queue for bulk email operations
2. **Email Tracking**: Add open/click tracking
3. **Email Templates**: Add more template variations
4. **Attachments**: Support more attachment types
5. **Scheduling**: Add email scheduling functionality
6. **Analytics**: Email delivery analytics dashboard
7. **Resend Logic**: Automatic retry for failed emails
8. **Unsubscribe**: Add unsubscribe functionality

---

## Summary

**Total Email Templates**: 9

**Total Email Triggers**: 15+ (across multiple components)

**Email API Routes**: 2

**Email Library Functions**: 15+

**Environment Variables**: 10+

**Supported Recipient Types**: Student/Parent, Faculty, Enrollment Team

**Email Features**:
- Template-based emails
- Variable substitution
- BCC/CC support
- Attachments
- HTML rendering
- Plain text fallback
- Error handling
- Logging
- Validation rules
- Recipient deduplication

---

## File Locations

### API Routes
- `src/app/api/leads/[id]/send-email/route.ts` - Main email sending
- `src/app/api/leads/[id]/demo-feedback/route.ts` - Demo feedback
- `src/app/api/email-templates/route.ts` - Template management

### Components
- `src/components/student/pipeline/DemoStepPanel.tsx` - Demo emails
- `src/components/student/pipeline/DocumentsStepPanel.tsx` - Document emails
- `src/components/student/pipeline/FeesStepPanel.tsx` - Fee emails
- `src/components/student/pipeline/ScheduleStepPanel.tsx` - Schedule emails
- `src/components/student/StudentReportModal.tsx` - Report emails
- `src/components/student/StudentReportVersionsModal.tsx` - Report version emails

### Library Functions
- `src/lib/email/sendMail.ts` - Core email sending
- `src/lib/email/sendDemoInviteMail.ts` - Demo invite logic
- `src/lib/email/sendFeesEnrollmentBundle.ts` - Fee+enrollment bundle
- `src/lib/email/teacherFeedbackEmails.ts` - Teacher feedback notifications
- `src/lib/email/renderTemplate.ts` - Template rendering
- `src/lib/email/buildLeadEmailVars.ts` - Variable building
- `src/lib/email/buildBrochureBundleEmailVars.ts` - Brochure variables
- `src/lib/email/feeBankDetailsForEmail.ts` - Fee bank details
- `src/lib/email/templateKeys.ts` - Template definitions
- `src/lib/email/defaultEmailTemplates.ts` - Default templates
- `src/lib/email/ensureDefaultTemplates.ts` - Template seeding
- `src/lib/email/enrollmentRecipients.ts` - BCC management
- `src/lib/email/mailRecipients.ts` - Recipient normalization
- `src/lib/email/appBaseUrl.ts` - Base URL
- `src/lib/email/enrollmentFormLink.ts` - Enrollment link
- `src/lib/email/demoInviteLog.ts` - Demo invite logging

### Models
- `src/models/EmailTemplate.ts` - Email template model
- `src/models/DemoTeacherFeedbackToken.ts` - Feedback token model

### Client Utilities
- `src/lib/leadPipelineEmailClient.ts` - Client email sending wrapper

---

**Document Version**: 1.0  
**Last Updated**: April 20, 2026  
**Maintained By**: Development Team
