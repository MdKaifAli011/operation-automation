import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Reserves a teacher for one demo row for a fixed window from IST start time.
 * Globally unique per teacherKey: no two demos may overlap this window.
 */
const TeacherDemoBookingSchema = new Schema(
  {
    /** Normalized teacher name for lookups (trim, lower, collapsed spaces). */
    teacherKey: { type: String, required: true, index: true },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    meetRowId: { type: String, required: true, trim: true },
    /** Normalized subject key (for same teacher/time shared group demos). */
    subjectKey: { type: String, default: "", trim: true, index: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    /** Original display name for admin/debug */
    teacherDisplay: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

TeacherDemoBookingSchema.index({ leadId: 1, meetRowId: 1 }, { unique: true });
TeacherDemoBookingSchema.index({ teacherKey: 1, start: 1, end: 1 });
TeacherDemoBookingSchema.index({ teacherKey: 1, subjectKey: 1, start: 1, end: 1 });

export type TeacherDemoBookingDocument = InferSchemaType<
  typeof TeacherDemoBookingSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const TeacherDemoBookingModel =
  mongoose.models.TeacherDemoBooking ??
  mongoose.model(
    "TeacherDemoBooking",
    TeacherDemoBookingSchema,
    "teacher_demo_bookings",
  );

export default TeacherDemoBookingModel;
