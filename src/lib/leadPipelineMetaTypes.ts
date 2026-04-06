/**
 * TypeScript mirror of `PipelineMetaSchema` / Lead.pipelineMeta.
 * Source of truth for persisted student workspace data in MongoDB.
 */

export type DemoTableRowPersisted = {
  subject: string;
  teacher: string;
  studentTimeZone: string;
  status: string;
  isoDate: string;
  timeHmIST: string;
  inviteSent?: boolean;
  inviteSentAt?: string | null;
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
export type LeadPipelineMeta = {
  demo?: LeadPipelineDemo;
  brochure?: LeadPipelineBrochure;
  fees?: LeadPipelineFees;
  schedule?: LeadPipelineSchedule;
};
