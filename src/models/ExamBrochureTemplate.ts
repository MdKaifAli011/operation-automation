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
 * Default brochure content per target exam — shown on student pipeline step 2
 * and editable under Course Brochures. Multiple brochures per exam live in
 * `brochures`; legacy top-level title/link/file fields are migrated on read.
 */
const ExamBrochureTemplateSchema = new Schema(
  {
    exam: { type: String, required: true, unique: true, trim: true },
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
