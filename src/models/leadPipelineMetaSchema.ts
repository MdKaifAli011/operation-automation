/**
 * Structured MongoDB shape for everything on the student / lead workspace
 * (demos, brochure, fee plan, schedule). Stored on Lead.pipelineMeta.
 * Not localStorage — all persisted via Lead document in the `leads` collection.
 */
import { Schema } from "mongoose";

/** One scheduled demo class row (stored per student in MongoDB) */
export const DemoRowSchema = new Schema(
  {
    examValue: { type: String, default: "", trim: true },
    subject: { type: String, default: "" },
    teacher: { type: String, default: "" },
    studentTimeZone: { type: String, default: "Asia/Kolkata" },
    status: { type: String, default: "Scheduled" },
    isoDate: { type: String, default: "" },
    timeHmIST: { type: String, default: "" },
    /** Whether invite was marked sent for this specific demo */
    inviteSent: { type: Boolean, default: false },
    inviteSentAt: { type: String, default: null },
    /** Stable key for Meet booking (UUID per row) */
    meetRowId: { type: String, default: "" },
    /** Assigned Google Meet URL for this slot */
    meetLinkUrl: { type: String, default: "" },
    meetBookingId: { type: String, default: "" },
    meetWindowStartIso: { type: String, default: "" },
    meetWindowEndIso: { type: String, default: "" },
    /** When true, server/client may email the teacher once the feedback window opens */
    teacherFeedbackAutoEmail: { type: Boolean, default: false },
    /** ISO — staff sent the one-time teacher feedback link */
    teacherFeedbackInviteSentAt: { type: String, default: null },
    /** ISO — teacher submitted the feedback form (link no longer valid) */
    teacherFeedbackSubmittedAt: { type: String, default: null },
    teacherFeedbackRating: { type: String, default: "" },
    teacherFeedbackStrengths: { type: String, default: "" },
    teacherFeedbackImprovements: { type: String, default: "" },
    teacherFeedbackNotes: { type: String, default: "" },
    teacherFeedbackExamTrack: { type: String, default: "" },
    teacherFeedbackSessionTopics: { type: String, default: "" },
    teacherFeedbackPaceFit: { type: String, default: "" },
    teacherFeedbackRatingEngagement: { type: String, default: "" },
    teacherFeedbackRatingConceptual: { type: String, default: "" },
    teacherFeedbackRatingApplication: { type: String, default: "" },
    teacherFeedbackRatingExamReadiness: { type: String, default: "" },
    teacherFeedbackParentInvolvement: { type: String, default: "" },
    teacherFeedbackRecommendedNext: { type: String, default: "" },
    teacherFeedbackFollowUpHomework: { type: String, default: "" },
  },
  { _id: false },
);

const DemoBlockSchema = new Schema(
  {
    rows: { type: [DemoRowSchema], default: [] },
    /** ISO time — last time a demo invite was marked shared */
    lastInviteSharedAt: { type: String, default: null },
    lastInviteSummary: { type: String, default: "" },
  },
  { _id: false },
);

const BrochureBlockSchema = new Schema(
  {
    notes: { type: String, default: "" },
    fileName: { type: String, default: null },
    /** Public URL path under /uploads/brochures/{leadId}/… (saved file on server) */
    storedFileUrl: { type: String, default: null },
    /** User-pasted PDF/image URL (optional) */
    documentUrl: { type: String, default: "" },
    generated: { type: Boolean, default: false },
    sentWhatsApp: { type: Boolean, default: false },
    sentEmail: { type: Boolean, default: false },
    sentWhatsAppAt: { type: String, default: null },
    sentEmailAt: { type: String, default: null },
  },
  { _id: false },
);

const StudentReportBlockSchema = new Schema(
  {
    pdfUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    generatedAt: { type: String, default: null },
    additionalNotes: { type: String, default: "" },
    recommendations: { type: String, default: "" },
    generatedForMeetRowId: { type: String, default: null },
    sendConfirmedAt: { type: String, default: null },
  },
  { _id: false },
);

const DocumentsItemSchema = new Schema(
  {
    key: { type: String, default: "" },
    title: { type: String, default: "" },
    countLabel: { type: String, default: "" },
    status: { type: String, default: "" },
    sentAt: { type: String, default: null },
    isCustom: { type: Boolean, default: false },
    documentUrl: { type: String, default: null },
    storedFileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
  },
  { _id: false },
);

const DocumentsBlockSchema = new Schema(
  {
    items: { type: [DocumentsItemSchema], default: [] },
  },
  { _id: false },
);

const FeeInstallmentRowSchema = new Schema(
  {
    id: { type: String, default: "" },
    description: { type: String, default: "" },
    amountInr: { type: Number, default: 0 },
    dueDate: { type: String, default: "" },
  },
  { _id: false },
);

const FeesBlockSchema = new Schema(
  {
    scholarshipPct: { type: Number, default: 0 },
    installmentEnabled: { type: Boolean, default: false },
    installmentCount: { type: Number, default: 2 },
    installmentAmounts: { type: [Number], default: [] },
    installmentDates: { type: [String], default: [] },
    currency: { type: String, default: "INR" },
    /** Base course fee before scholarship */
    baseTotal: { type: Number, default: 0 },
    /** Final fee after scholarship % */
    finalFee: { type: Number, default: 0 },
    targetExamValue: { type: String, default: "" },
    catalogCourseId: { type: String, default: "" },
    courseDuration: { type: String, default: "" },
    customCourseName: { type: String, default: "" },
    feeMasterDueDate: { type: String, default: null },
    installmentRows: { type: [FeeInstallmentRowSchema], default: [] },
    feeSentWhatsApp: { type: Boolean, default: false },
    feeSentEmail: { type: Boolean, default: false },
    enrollmentSent: { type: Boolean, default: false },
    feeSentWhatsAppAt: { type: String, default: null },
    feeSentEmailAt: { type: String, default: null },
    enrollmentSentAt: { type: String, default: null },
    feeSelectedBankAccountId: { type: String, default: null },
    feePlanPdfUrl: { type: String, default: null },
    feePlanPdfFileName: { type: String, default: null },
    feePlanPdfGeneratedAt: { type: String, default: null },
  },
  { _id: false },
);

const ScheduleClassRowSchema = new Schema(
  {
    day: { type: String, default: "" },
    subject: { type: String, default: "" },
    timeIST: { type: String, default: "" },
    timeLocal: { type: String, default: "" },
    teacher: { type: String, default: "" },
    duration: { type: String, default: "" },
  },
  { _id: false },
);

const ScheduleBlockSchema = new Schema(
  {
    /** `"table"` | `"calendar"` */
    view: { type: String, default: "table" },
    scheduleSentWhatsApp: { type: Boolean, default: false },
    scheduleSentEmail: { type: Boolean, default: false },
    scheduleSentWhatsAppAt: { type: String, default: null },
    scheduleSentEmailAt: { type: String, default: null },
    completedAt: { type: String, default: null },
    /** Optional weekly grid rows — extend UI to fill */
    classes: { type: [ScheduleClassRowSchema], default: [] },
    weekLabel: { type: String, default: "" },
    /** Monday-based week anchor for calendar navigation (ISO string) */
    weekStartIso: { type: String, default: null },
  },
  { _id: false },
);

/**
 * Full pipeline payload for one lead. `strict: false` keeps legacy/extra keys
 * from older documents until migrated.
 */
export const PipelineMetaSchema = new Schema(
  {
    demo: { type: DemoBlockSchema, default: () => ({ rows: [] }) },
    brochure: { type: BrochureBlockSchema, default: () => ({}) },
    studentReport: { type: StudentReportBlockSchema, default: () => ({}) },
    documents: { type: DocumentsBlockSchema, default: () => ({}) },
    fees: { type: FeesBlockSchema, default: () => ({}) },
    schedule: { type: ScheduleBlockSchema, default: () => ({}) },
  },
  { _id: false, strict: false },
);
