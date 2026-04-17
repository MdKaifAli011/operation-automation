import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ExamCourseEntrySchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    examValue: { type: String, required: true, trim: true, maxlength: 64 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    durationValue: { type: Number, min: 1, max: 999, default: undefined },
    durationUnit: { type: String, enum: ["years", "hours"], default: undefined },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const ExamCourseCatalogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    courses: { type: [ExamCourseEntrySchema], default: [] },
  },
  { timestamps: true },
);

export type ExamCourseCatalogDocument = InferSchemaType<
  typeof ExamCourseCatalogSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const ExamCourseCatalogModel =
  mongoose.models.ExamCourseCatalog ??
  mongoose.model(
    "ExamCourseCatalog",
    ExamCourseCatalogSchema,
    "exam_course_catalog",
  );

export default ExamCourseCatalogModel;
