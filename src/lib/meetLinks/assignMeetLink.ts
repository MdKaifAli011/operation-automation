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
};

/**
 * Reserves Google Meet + teacher slot for one demo row.
 * Clears prior bookings for that row, then checks teacher availability, then Meet URL.
 */
export async function assignMeetLinkForDemoRow(params: {
  leadId: string;
  meetRowId: string;
  isoDate: string;
  timeHmIST: string;
  /** Meet URL hold (minutes from start); defaults from env. */
  durationMinutes?: number;
  /** Teacher display name (required for scheduling). */
  teacher: string;
  /** Teacher block duration; defaults from env (typically 120). */
  teacherBlockMinutes?: number;
}): Promise<AssignOk | { error: string; code?: string }> {
  const { leadId, meetRowId, isoDate, timeHmIST } = params;
  if (!mongoose.Types.ObjectId.isValid(leadId)) {
    return { error: "Invalid lead id.", code: "bad_request" };
  }
  if (!meetRowId?.trim()) {
    return { error: "Missing meetRowId for this demo row.", code: "bad_request" };
  }

  const teacherTrim = String(params.teacher ?? "").trim();
  if (!teacherTrim) {
    return {
      error: "A teacher must be selected before reserving a demo slot.",
      code: "bad_request",
    };
  }
  const teacherKey = normalizeTeacherKey(teacherTrim);
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

  await MeetBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });
  await TeacherDemoBookingModel.deleteMany({ leadId: rowLeadId, meetRowId: mrid });

  const teacherOverlap = await TeacherDemoBookingModel.exists({
    teacherKey,
    start: { $lt: teacherWin.end },
    end: { $gt: teacherWin.start },
  });
  if (teacherOverlap) {
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

  const { start, end } = meetWin;

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
