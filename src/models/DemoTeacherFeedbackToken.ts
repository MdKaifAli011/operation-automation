import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * One-time teacher feedback link per demo row. After `submittedAt` is set, the token is consumed.
 */
const DemoTeacherFeedbackTokenSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, trim: true, index: true },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: true,
      index: true,
    },
    meetRowId: { type: String, required: true, trim: true, index: true },
    teacherName: { type: String, default: "", trim: true },
    submittedAt: { type: Date, default: null },
    rating: { type: String, default: "" },
    strengths: { type: String, default: "" },
    improvements: { type: String, default: "" },
    notes: { type: String, default: "" },
    examTrack: { type: String, default: "", trim: true },
    sessionTopicsCovered: { type: String, default: "", trim: true },
    paceFit: { type: String, default: "", trim: true },
    ratingEngagement: { type: String, default: "", trim: true },
    ratingConceptual: { type: String, default: "", trim: true },
    ratingApplication: { type: String, default: "", trim: true },
    ratingExamReadiness: { type: String, default: "", trim: true },
    parentInvolvement: { type: String, default: "", trim: true },
    recommendedNext: { type: String, default: "", trim: true },
    followUpHomework: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

DemoTeacherFeedbackTokenSchema.index({ leadId: 1, meetRowId: 1 });

export type DemoTeacherFeedbackTokenDocument = InferSchemaType<
  typeof DemoTeacherFeedbackTokenSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const DemoTeacherFeedbackTokenModel =
  mongoose.models.DemoTeacherFeedbackToken ??
  mongoose.model(
    "DemoTeacherFeedbackToken",
    DemoTeacherFeedbackTokenSchema,
    "demo_teacher_feedback_tokens",
  );

export default DemoTeacherFeedbackTokenModel;
