import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import MeetBookingModel from "@/models/MeetBooking";
import MeetLinkModel from "@/models/MeetLink";
import TeacherDemoBookingModel from "@/models/TeacherDemoBooking";
import LeadModel from "@/models/Lead";
import {
  computeMeetWindow,
  computeTeacherBlockWindow,
  getMeetHoldDurationMinutes,
} from "@/lib/meetLinks/window";
import { getTeacherBlockDurationMinutes } from "@/lib/demoSchedule/durations";
import { normalizeTeacherKey } from "@/lib/demoSchedule/teacherKey";

export type AssignOk = {
  meetLinkUrl: string;
  meetBookingId: string;
  meetWindowStartIso: string;
  meetWindowEndIso: string;
  sharedFromExisting?: boolean;
};

function normalizeSubjectKey(subject: string): string {
  return subject.trim().toLowerCase().replace(/\s+/g, " ");
}

type OverlapLean = {
  leadId: mongoose.Types.ObjectId;
  meetRowId: string;
  subjectKey?: string;
  start: Date;
  end: Date;
};

async function attachRowToExistingMeetFromOverlap(
  overlap: OverlapLean,
  params: {
    rowLeadId: mongoose.Types.ObjectId;
    mrid: string;
    teacherKey: string;
    subjectKey: string;
    teacherTrim: string;
    teacherWin: { start: Date; end: Date };
    meetStart: Date;
    meetEnd: Date;
  },
): Promise<AssignOk | null> {
  const bookedLeadId = String(overlap.leadId);
  const bookedMeetRowId = String(overlap.meetRowId);
  const existingMeet = await MeetBookingModel.findOne({
    leadId: new mongoose.Types.ObjectId(bookedLeadId),
    meetRowId: bookedMeetRowId,
  });
  if (!existingMeet) return null;

  const meetDoc = await MeetBookingModel.create({
    meetLinkId: existingMeet.meetLinkId,
    leadId: params.rowLeadId,
    meetRowId: params.mrid,
    start: params.meetStart,
    end: params.meetEnd,
    meetUrl: existingMeet.meetUrl,
  });
  await TeacherDemoBookingModel.create({
    teacherKey: params.teacherKey,
    subjectKey: params.subjectKey,
    teacherDisplay: params.teacherTrim,
    leadId: params.rowLeadId,
    meetRowId: params.mrid,
    start: params.teacherWin.start,
    end: params.teacherWin.end,
  });
  return {
    meetLinkUrl: existingMeet.meetUrl,
    meetBookingId: String(meetDoc._id),
    meetWindowStartIso: params.meetStart.toISOString(),
    meetWindowEndIso: params.meetEnd.toISOString(),
    sharedFromExisting: true,
  };
}

/**
 * Reserves Google Meet + teacher slot for one demo row.
 * Clears prior bookings for that row, then checks teacher availability, then Meet URL.
 */
export async function assignMeetLinkForDemoRow(params: {
  leadId: string;
  meetRowId: string;
  isoDate: string;
  timeHmIST: string;
  /** Subject display name (normalized and stored on the teacher booking row). */
  subject?: string;
  /** Meet URL hold (minutes from start); defaults from env. */
  durationMinutes?: number;
  /** Teacher display name (required for scheduling). */
  teacher: string;
  /** Teacher block duration; defaults from env (typically 120). */
  teacherBlockMinutes?: number;
  /**
   * User confirmed sharing the same Google Meet as another student’s demo in this teacher time window.
   * Feedback links stay per demo row (per meetRowId).
   */
  confirmSharedTeacherSlot?: boolean;
}): Promise<AssignOk | { error: string; code?: string }> {
  const { leadId, meetRowId, isoDate, timeHmIST } = params;
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    return { error: "Invalid lead id.", code: "bad_request" };
  }
  if (!meetRowId?.trim()) {
    return { error: "Missing meetRowId for this demo row.", code: "bad_request" };
  }

  const teacherTrim = String(params.teacher ?? "").trim();
  const subjectTrim = String(params.subject ?? "").trim();
  if (!teacherTrim) {
    return {
      error: "A teacher must be selected before reserving a demo slot.",
      code: "bad_request",
    };
  }
  const teacherKey = normalizeTeacherKey(teacherTrim);
  const subjectKey = normalizeSubjectKey(subjectTrim);
  if (!teacherKey) {
    return { error: "A teacher must be selected before reserving a demo slot.", code: "bad_request" };
  }

  const meetDur = params.durationMinutes ?? getMeetHoldDurationMinutes();
  const teacherDur = params.teacherBlockMinutes ?? getTeacherBlockDurationMinutes();

  const meetWin = computeMeetWindow(isoDate, timeHmIST, meetDur);
  const teacherWin = computeTeacherBlockWindow(isoDate, timeHmIST, teacherDur);
  if (!meetWin || !teacherWin) {
    return { error: "Invalid demo date or time.", code: "bad_slot" };
  }

  await connectDB();

  const leadExists = await LeadModel.exists({ _id: leadId });
  if (!leadExists) {
    return { error: "Lead not found.", code: "not_found" };
  }

  const rowLeadId = new mongoose.Types.ObjectId(leadId);
  const mrid = meetRowId.trim();
  const { start, end } = meetWin;

  await MeetBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });
  await TeacherDemoBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });

  // Guardrail: do not allow duplicate teacher-slot rows on the same lead.
  // Group sharing is only for different leads (different students).
  const duplicateOnSameLead = await TeacherDemoBookingModel.exists({
    leadId: rowLeadId,
    teacherKey,
    start: { $lt: teacherWin.end },
    end: { $gt: teacherWin.start },
  });
  if (duplicateOnSameLead) {
    return {
      error:
        "This student already has a demo with the same teacher in this time window. Edit the existing row instead of creating a duplicate.",
      code: "duplicate_on_same_lead",
    };
  }

  const teacherOverlap = (await TeacherDemoBookingModel.findOne({
    teacherKey,
    start: { $lt: teacherWin.end },
    end: { $gt: teacherWin.start },
  }).lean()) as OverlapLean | null;

  if (teacherOverlap) {
    const otherLeadId = String(teacherOverlap.leadId);
    if (otherLeadId !== String(rowLeadId)) {
      const exactWindowMatch =
        teacherOverlap.start.getTime() === teacherWin.start.getTime() &&
        teacherOverlap.end.getTime() === teacherWin.end.getTime();

      const attachCtx = {
        rowLeadId,
        mrid,
        teacherKey,
        subjectKey,
        teacherTrim,
        teacherWin,
        meetStart: start,
        meetEnd: end,
      };

      /** Always require explicit confirm when sharing one teacher block across two leads (same Meet, separate feedback). */
      if (params.confirmSharedTeacherSlot && exactWindowMatch) {
        const shared = await attachRowToExistingMeetFromOverlap(
          teacherOverlap,
          attachCtx,
        );
        if (shared) return shared;
        return {
          error:
            "Could not attach to the existing demo — the Meet link for that slot is missing. Try another time or contact support.",
          code: "shared_slot_missing",
        };
      }

      if (exactWindowMatch) {
        return {
          error:
            "This teacher already has a demo in this time slot with another student. You can reuse the same Google Meet link; teacher feedback links stay separate per student.",
          code: "teacher_busy_joinable",
        };
      }
    }

    const mins = teacherDur;
    return {
      error: `This teacher already has a demo in the ${mins}-minute window that starts at this time. Choose another teacher or a different date or time.`,
      code: "teacher_busy",
    };
  }

  const links = await MeetLinkModel.find({ active: true })
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  if (links.length === 0) {
    return {
      error:
        "No Google Meet links are configured yet. Add at least one Meet URL under Meet links before scheduling.",
      code: "no_links",
    };
  }

  for (const link of links) {
    const lid = link._id as mongoose.Types.ObjectId;
    const overlap = await MeetBookingModel.exists({
      meetLinkId: lid,
      start: { $lt: end },
      end: { $gt: start },
    });
    if (overlap) continue;

    const url = String(link.url ?? "").trim();
    if (!url) continue;

    let createdMeet: mongoose.Types.ObjectId | null = null;
    try {
      const meetDoc = await MeetBookingModel.create({
        meetLinkId: lid,
        leadId: rowLeadId,
        meetRowId: mrid,
        start,
        end,
        meetUrl: url,
      });
      createdMeet = meetDoc._id as mongoose.Types.ObjectId;

      await TeacherDemoBookingModel.create({
        teacherKey,
        subjectKey,
        teacherDisplay: teacherTrim,
        leadId: rowLeadId,
        meetRowId: mrid,
        start: teacherWin.start,
        end: teacherWin.end,
      });
    } catch (e) {
      if (createdMeet) {
        await MeetBookingModel.deleteMany({ _id: createdMeet });
      }
      throw e;
    }

    return {
      meetLinkUrl: url,
      meetBookingId: String(createdMeet),
      meetWindowStartIso: start.toISOString(),
      meetWindowEndIso: end.toISOString(),
    };
  }

  return {
    error:
      "Every Google Meet link is already booked for this time window. Add another link or choose a different time.",
    code: "all_busy",
  };
}

export async function releaseMeetBookingForRow(
  leadId: string,
  meetRowId: string,
): Promise<void> {
  if (!meetRowId?.trim()) return;
  await connectDB();
  const rowLeadId = new mongoose.Types.ObjectId(leadId);
  const mrid = meetRowId.trim();
  await MeetBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });
  await TeacherDemoBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });
}

/** Alias: releases both Meet and teacher holds for this demo row. */
export async function releaseDemoRowResources(
  leadId: string,
  meetRowId: string,
): Promise<void> {
  await releaseMeetBookingForRow(leadId, meetRowId);
}
