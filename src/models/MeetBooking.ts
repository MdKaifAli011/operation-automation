import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Holds a time window during which a Meet link is reserved for one demo row
 * (`leadId` + `meetRowId`). Overlapping windows for the same `meetLinkId` are forbidden.
 */
const MeetBookingSchema = new Schema(
  {
    meetLinkId: {
      type: Schema.Types.ObjectId,
      ref: "MeetLink",
      required: true,
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    /** Stable id for this demo row on the lead (client-generated UUID). */
    meetRowId: { type: String, required: true, trim: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    meetUrl: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

MeetBookingSchema.index({ leadId: 1, meetRowId: 1 }, { unique: true });
MeetBookingSchema.index({ meetLinkId: 1, start: 1, end: 1 });

export type MeetBookingDocument = InferSchemaType<typeof MeetBookingSchema> & {
  _id: mongoose.Types.ObjectId;
};

const MeetBookingModel =
  mongoose.models.MeetBooking ??
  mongoose.model("MeetBooking", MeetBookingSchema, "meet_bookings");

export default MeetBookingModel;
