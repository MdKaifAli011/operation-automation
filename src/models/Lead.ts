import mongoose, { Schema, type InferSchemaType } from "mongoose";

const sheetTabs = ["ongoing", "followup", "not_interested", "converted"] as const;
const rowTones = [
  "interested",
  "not_interested",
  "followup_later",
  "new",
  "called_no_response",
] as const;

const LeadSchema = new Schema(
  {
    date: { type: String, required: true },
    followUpDate: { type: String, default: null },
    studentName: { type: String, required: true, trim: true },
    parentName: { type: String, default: "", trim: true },
    dataType: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true },
    targetExams: { type: [String], default: [] },
    country: { type: String, default: "India", trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    pipelineSteps: { type: Number, default: 0, min: 0, max: 4 },
    rowTone: {
      type: String,
      enum: rowTones,
      default: "new",
    },
    sheetTab: {
      type: String,
      enum: sheetTabs,
      default: "ongoing",
    },
  },
  { timestamps: true },
);

export type LeadDocument = InferSchemaType<typeof LeadSchema> & {
  _id: mongoose.Types.ObjectId;
};

const LeadModel =
  mongoose.models.Lead ?? mongoose.model("Lead", LeadSchema, "leads");

export default LeadModel;
