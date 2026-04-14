import mongoose, { Schema, type InferSchemaType } from "mongoose";

const BrochureItemSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    summary: { type: String, default: "" },
    linkUrl: { type: String, default: "", trim: true },
    linkLabel: { type: String, default: "", trim: true },
    storedFileUrl: { type: String, default: null },
    storedFileName: { type: String, default: null },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

/**
 * Brochures per target exam **and** course (from Exam courses catalog).
 * `courseId` empty string = legacy single-doc-per-exam before courses existed.
 */
const ExamBrochureTemplateSchema = new Schema(
  {
    exam: { type: String, required: true, trim: true },
    courseId: { type: String, required: true, trim: true, default: "" },
    brochures: { type: [BrochureItemSchema], default: [] },
    /** @deprecated Use `brochures` — kept for migration from older documents */
    title: { type: String, default: "", trim: true },
    summary: { type: String, default: "" },
    linkUrl: { type: String, default: "", trim: true },
    linkLabel: { type: String, default: "", trim: true },
    storedFileUrl: { type: String, default: null },
    storedFileName: { type: String, default: null },
  },
  { timestamps: true },
);

ExamBrochureTemplateSchema.index(
  { exam: 1, courseId: 1 },
  { unique: true },
);

export type ExamBrochureTemplateDocument = InferSchemaType<
  typeof ExamBrochureTemplateSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const ExamBrochureTemplateModel =
  mongoose.models.ExamBrochureTemplate ??
  mongoose.model(
    "ExamBrochureTemplate",
    ExamBrochureTemplateSchema,
    "exam_brochure_templates",
  );

export default ExamBrochureTemplateModel;
