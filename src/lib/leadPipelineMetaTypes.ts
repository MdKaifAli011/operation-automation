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
  feeSentWhatsApp?: boolean;
  feeSentEmail?: boolean;
  enrollmentSent?: boolean;
  feeSentWhatsAppAt?: string | null;
  feeSentEmailAt?: string | null;
  enrollmentSentAt?: string | null;
  /** Institute bank account id (from Bank & A/c Details) chosen for this lead’s fee step. */
  feeSelectedBankAccountId?: string | null;
};

export type LeadPipelineScheduleClass = {
  day?: string;
  subject?: string;
  timeIST?: string;
  timeLocal?: string;
  teacher?: string;
  duration?: string;
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
};

/** Full `pipelineMeta` object stored on each Lead document */
/** Generated student progress report (PDF) + staff inputs; Step 2 · Documents */
export type LeadPipelineStudentReport = {
  /** Public path e.g. `/uploads/student-reports/{leadId}/…pdf` */
  pdfUrl?: string | null;
  fileName?: string | null;
  /** ISO — last successful PDF generation */
  generatedAt?: string | null;
  /** Staff text included in PDF and editable before each generate */
  additionalNotes?: string;
  recommendations?: string;
  /** ISO — staff confirmed the report is OK to share with the family */
  sendConfirmedAt?: string | null;
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
