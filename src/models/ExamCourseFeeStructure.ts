import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Default base fee (INR) per target exam **and** catalog course — used in Fee Management
 * and to auto-fill student workspace when both exam and course match.
 */
const ExamCourseFeeStructureSchema = new Schema(
  {
    exam: { type: String, required: true, trim: true },
    courseId: { type: String, required: true, trim: true },
    baseFee: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

ExamCourseFeeStructureSchema.index(
  { exam: 1, courseId: 1 },
  { unique: true },
);

export type ExamCourseFeeStructureDocument = InferSchemaType<
  typeof ExamCourseFeeStructureSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const ExamCourseFeeStructureModel =
  mongoose.models.ExamCourseFeeStructure ??
  mongoose.model(
    "ExamCourseFeeStructure",
    ExamCourseFeeStructureSchema,
    "exam_course_fee_structures",
  );

export default ExamCourseFeeStructureModel;
