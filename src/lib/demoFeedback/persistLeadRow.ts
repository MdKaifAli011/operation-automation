import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import LeadModel from "@/models/Lead";
import { appendActivity } from "@/lib/pipeline";
import type { PipelineActivity } from "@/lib/types";

export async function patchDemoRowTeacherFeedback(
  leadId: string,
  meetRowId: string,
  patch: {
    teacherFeedbackInviteSentAt?: string;
    teacherFeedbackSubmittedAt?: string;
    teacherFeedbackRating?: string;
    teacherFeedbackStrengths?: string;
    teacherFeedbackImprovements?: string;
    teacherFeedbackNotes?: string;
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
  },
  activity?: { kind: PipelineActivity["kind"]; message: string },
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(leadId) || !meetRowId?.trim()) return;
  await connectDB();
  const lead = await LeadModel.findById(leadId);
  if (!lead) throw new Error("Lead not found.");

  const pm = lead.pipelineMeta
    ? (JSON.parse(JSON.stringify(lead.pipelineMeta)) as Record<string, unknown>)
    : {};
  const demo = (pm.demo as Record<string, unknown> | undefined) ?? {};
  const rows = Array.isArray(demo.rows)
    ? ([...demo.rows] as Array<Record<string, unknown>>)
    : [];
  const i = rows.findIndex(
    (r) => String(r.meetRowId ?? "").trim() === meetRowId.trim(),
  );
  if (i === -1) throw new Error("Demo row not found.");

  rows[i] = { ...rows[i], ...patch };
  demo.rows = rows;
  pm.demo = demo;
  lead.pipelineMeta = pm as typeof lead.pipelineMeta;
  lead.markModified("pipelineMeta");

  if (activity) {
    lead.activityLog = appendActivity(
      lead.activityLog as PipelineActivity[] | undefined,
      activity.kind,
      activity.message,
    ) as unknown as typeof lead.activityLog;
    lead.markModified("activityLog");
  }

  await lead.save();
}
