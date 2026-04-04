import mongoose, { Schema, type InferSchemaType } from "mongoose";

const feeStatuses = ["Paid", "Partial", "Pending", "Overdue"] as const;

const FeeRecordSchema = new Schema(
  {
    studentName: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    total: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    emiMonths: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: feeStatuses,
      default: "Pending",
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      default: null,
    },
  },
  { timestamps: true },
);

export type FeeRecordDocument = InferSchemaType<typeof FeeRecordSchema> & {
  _id: mongoose.Types.ObjectId;
};

const FeeRecordModel =
  mongoose.models.FeeRecord ??
  mongoose.model("FeeRecord", FeeRecordSchema, "fee_records");

export default FeeRecordModel;
