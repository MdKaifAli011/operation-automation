import mongoose, { Schema } from "mongoose";

const ExamSubjectEntrySchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    examValue: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const ExamSubjectCatalogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    subjects: { type: [ExamSubjectEntrySchema], default: [] },
  },
  { timestamps: true },
);

const ExamSubjectCatalogModel =
  mongoose.models.ExamSubjectCatalog ??
  mongoose.model(
    "ExamSubjectCatalog",
    ExamSubjectCatalogSchema,
    "exam_subject_catalog",
  );

export default ExamSubjectCatalogModel;
