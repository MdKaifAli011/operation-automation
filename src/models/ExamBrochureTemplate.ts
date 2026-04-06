import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Default brochure content per target exam — shown on student pipeline step 2
 * and editable under Course Brochures.
 */
const ExamBrochureTemplateSchema = new Schema(
  {
    exam: { type: String, required: true, unique: true, trim: true },
    title: { type: String, default: "", trim: true },
    /** Shown on student step; can be copied into performance notes */
    summary: { type: String, default: "" },
    /** Optional public URL to PDF (Drive, S3, static host, …) */
    linkUrl: { type: String, default: "", trim: true },
    /** Display name for the linked document */
    linkLabel: { type: String, default: "", trim: true },
    /** Server-stored file under /uploads/exam-brochures/{exam}/… (takes precedence over linkUrl in UI) */
    storedFileUrl: { type: String, default: null },
    storedFileName: { type: String, default: null },
  },
  { timestamps: true },
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
