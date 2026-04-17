/**
 * TypeScript mirror of `PipelineMetaSchema` / Lead.pipelineMeta.
 * Source of truth for persisted student workspace data in MongoDB.
 */

export type DemoTableRowPersisted = {
  /** Target exam value (NEET, JEE, …) chosen when scheduling this row */
  examValue?: string;
  subject: string;
  teacher: string;
  studentTimeZone: string;
  status: string;
  isoDate: string;
  timeHmIST: string;
  inviteSent?: boolean;
  inviteSentAt?: string | null;
  /** Stable id for Meet pool booking (one per demo row). */
  meetRowId?: string;
  meetLinkUrl?: string;
  meetBookingId?: string;
  meetWindowStartIso?: string;
  meetWindowEndIso?: string;
  teacherFeedbackInviteSentAt?: string | null;
  /** When true, email the teacher once as soon as the feedback window opens (client-triggered). */
  teacherFeedbackAutoEmail?: boolean;
  teacherFeedbackSubmittedAt?: string | null;
  teacherFeedbackRating?: string;
  teacherFeedbackStrengths?: string;
  teacherFeedbackImprovements?: string;
  teacherFeedbackNotes?: string;
  /** Extended feedback: NEET/JEE/SAT/IB track etc. */
  teacherFeedbackExamTrack?: string;
  teacherFeedbackSessionTopics?: string;
  teacherFeedbackPaceFit?: string;
  teacherFeedbackRatingEngagement?: string;
  teacherFeedbackRatingConceptual?: string;
  teacherFeedbackRatingApplication?: string;
  teacherFeedbackRatingExamReadiness?: string;
  teacherFeedbackParentInvolvement?: string;
  teacherFeedbackRecommendedNext?: string;
  teacherFeedbackFollowUpHomework?: string;
};

export type LeadPipelineDemo = {
  rows: DemoTableRowPersisted[];
  lastInviteSharedAt?: string | null;
  lastInviteSummary?: string;
};

export type LeadPipelineBrochure = {
  notes?: string;
  fileName?: string | null;
  /** e.g. `/uploads/brochures/{leadId}/{uuid}.pdf` */
  storedFileUrl?: string | null;
  /** Pasted link to a brochure PDF or image */
  documentUrl?: string | null;
  generated?: boolean;
  sentWhatsApp?: boolean;
  sentEmail?: boolean;
  sentWhatsAppAt?: string | null;
  sentEmailAt?: string | null;
  /** Catalog keys last emailed from Step 2 (e.g. `NEET-someKey`) */
  lastSentSelectionKeys?: string[];
};

/** One installment line on the Fees step (amounts in INR). */
export type LeadPipelineFeeInstallmentRow = {
  id: string;
  description: string;
  amountInr: number;
  /** yyyy-mm-dd */
  dueDate: string;
};

export type LeadPipelineFees = {
  scholarshipPct?: number;
  installmentEnabled?: boolean;
  installmentCount?: number;
  installmentAmounts?: number[];
  installmentDates?: string[];
  currency?: string;
  /** Total before scholarship */
  baseTotal?: number;
  /** After scholarship % */
  finalFee?: number;
  /** Selected target exam value for this fee quote */
  targetExamValue?: string;
  /** Catalog course id (Exam courses) when applicable */
  catalogCourseId?: string;
  courseDuration?: string;
  /** Optional label when not using catalog only */
  customCourseName?: string;
  /** Primary due date when using a single payment line */
  feeMasterDueDate?: string | null;
  /** Dynamic installments; when empty, single line uses finalFee + feeMasterDueDate */
  installmentRows?: LeadPipelineFeeInstallmentRow[];
  feeSentWhatsApp?: boolean;
  feeSentEmail?: boolean;
  enrollmentSent?: boolean;
  feeSentWhatsAppAt?: string | null;
  feeSentEmailAt?: string | null;
  enrollmentSentAt?: string | null;
  /** ISO — fee plan / fee-details email sent to parent from Step 3 (Fees). Drives pipeline completion for this step. */
  feePlanEmailSentAt?: string | null;
  /** Institute bank account id (from Bank & A/c Details) chosen for this lead’s fee step. */
  feeSelectedBankAccountId?: string | null;
  /** Generated fee-plan PDF public URL (`/uploads/fee-plans/{leadId}/...pdf`). */
  feePlanPdfUrl?: string | null;
  feePlanPdfFileName?: string | null;
  feePlanPdfGeneratedAt?: string | null;
};

export type LeadPipelineScheduleClass = {
  day?: string;
  subject?: string;
  timeIST?: string;
  timeLocal?: string;
  teacher?: string;
  duration?: string;
};

export type LeadPipelineScheduleProgrammeOverview = {
  commencementIsoDate?: string | null;
  programmeName?: string;
  startDateLabel?: string;
  durationLabel?: string;
  targetExamLabel?: string;
};

export type LeadPipelineWeeklySessionRow = {
  id: string;
  sessionLabel: string;
  day: string;
  timeIST: string;
  subject: string;
  sessionDuration: string;
  sortOrder: number;
};

export type LeadPipelineMilestoneRow = {
  id: string;
  targetDateLabel: string;
  milestone: string;
  description: string;
  sortOrder: number;
};

export type LeadPipelineScheduleGuidelines = {
  generalGuidelines: string[];
  mockTestsRevision: string[];
};

export type LeadPipelineSchedule = {
  view?: "table" | "calendar" | string;
  scheduleSentWhatsApp?: boolean;
  scheduleSentEmail?: boolean;
  scheduleSentWhatsAppAt?: string | null;
  scheduleSentEmailAt?: string | null;
  completedAt?: string | null;
  classes?: LeadPipelineScheduleClass[];
  weekLabel?: string;
  /** Monday 00:00:00.000Z for the displayed week (stored as ISO string) */
  weekStartIso?: string | null;
  /** Selected schedule template id (global admin template catalog). */
  templateId?: string | null;
  templateExamValue?: string | null;
  templateProgrammeName?: string | null;
  programmeOverview?: LeadPipelineScheduleProgrammeOverview;
  weeklySessionStructure?: LeadPipelineWeeklySessionRow[];
  milestones?: LeadPipelineMilestoneRow[];
  guidelines?: LeadPipelineScheduleGuidelines;
  /** Generated schedule PDF stored under /uploads/schedule-plans/{leadId}/... */
  pdfUrl?: string | null;
  pdfFileName?: string | null;
  pdfGeneratedAt?: string | null;
};

/** One archived PDF kept when staff generates or uploads a newer report */
export type StudentReportVersionEntry = {
  id: string;
  pdfUrl: string;
  fileName?: string | null;
  generatedAt?: string | null;
  source?: string;
  generatedForMeetRowId?: string | null;
};

/** Full `pipelineMeta` object stored on each Lead document */
/** Generated student progress report (PDF) + staff inputs; Step 2 · Documents */
export type LeadPipelineStudentReport = {
  /** Public path e.g. `/uploads/student-reports/{leadId}/…pdf` */
  pdfUrl?: string | null;
  fileName?: string | null;
  /** ISO — last successful PDF generation */
  generatedAt?: string | null;
  /** How current report was prepared. */
  source?: "teacher_feedback" | "manual_sales" | "uploaded_custom";
  /** Staff text included in PDF and editable before each generate */
  additionalNotes?: string;
  recommendations?: string;
  /** Sales fallback inputs when teacher feedback is unavailable. */
  manualQuestionsAttempted?: string;
  manualCorrectAnswers?: string;
  manualStudentLevel?: string;
  /** ISO — staff confirmed the report is OK to share with the family */
  sendConfirmedAt?: string | null;
  /** Optional demo row id when a single-report PDF was generated from one demo only. */
  generatedForMeetRowId?: string | null;
  /** Older PDFs kept on disk when a new one is generated or uploaded */
  versionHistory?: StudentReportVersionEntry[];
  /** Which PDF path to attach on “Send report” (defaults to latest `pdfUrl`) */
  activeSendPdfUrl?: string | null;
  activeSendFileName?: string | null;
  /** Last emailed report attachment (for student page visibility) */
  lastSentPdfUrl?: string | null;
  /** All PDF public paths included in the last report email (same send). */
  lastSentPdfUrls?: string[] | null;
  lastSentAt?: string | null;
};

/** Step 2 tracker rows (sheet-like Documents table). */
export type LeadPipelineDocumentItem = {
  /** Stable key in table (report, brochure, enrollment, courier, ranking, bank, custom-*) */
  key: string;
  title: string;
  countLabel?: string;
  status?: string;
  sentAt?: string | null;
  isCustom?: boolean;
  /** Optional direct URL entered by staff for custom docs. */
  documentUrl?: string | null;
  /** Optional uploaded file (stored under /public/uploads/lead-documents/{leadId}/...). */
  storedFileUrl?: string | null;
  fileName?: string | null;
};

export type LeadPipelineDocuments = {
  items?: LeadPipelineDocumentItem[];
};

export type LeadPipelineMeta = {
  demo?: LeadPipelineDemo;
  brochure?: LeadPipelineBrochure;
  /** Optional: generated PDF report for the student (Step 2) */
  studentReport?: LeadPipelineStudentReport;
  /** Step 2 documents table status + custom rows */
  documents?: LeadPipelineDocuments;
  fees?: LeadPipelineFees;
  schedule?: LeadPipelineSchedule;
};
