import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Default base course fee (INR) per target exam — used to auto-fill the fee step
 * on student leads and as reference in Fee Management.
 */
const ExamFeeStructureSchema = new Schema(
  {
    /** Matches `TARGET_EXAM_OPTIONS` (NEET, JEE, …) */
    exam: { type: String, required: true, unique: true, trim: true },
    baseFee: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export type ExamFeeStructureDocument = InferSchemaType<
  typeof ExamFeeStructureSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const ExamFeeStructureModel =
  mongoose.models.ExamFeeStructure ??
  mongoose.model(
    "ExamFeeStructure",
    ExamFeeStructureSchema,
    "exam_fee_structures",
  );

export default ExamFeeStructureModel;
