import mongoose, { Schema, type InferSchemaType } from "mongoose";

const sheetTabs = ["today", "old"] as const;
const rowTones = [
  "interested",
  "not_interested",
  "followup_later",
  "new",
  "called_no_response",
] as const;

/**
 * AllLead = separate collection for All Leads page with different storage
 * Similar structure to Lead but independent database table
 */
const AllLeadSchema = new Schema(
  {
    date: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    followUpDate: { type: String, default: null },
    studentName: { type: String, trim: true, default: "Add Student Name" },
    parentName: { type: String, default: "", trim: true },
    dataType: { type: String, trim: true, default: "Organic" },
    grade: { type: String, trim: true, default: "12th" },
    targetExams: { type: [String], default: [] },
    country: { type: String, default: "India", trim: true },
    phone: { type: String, trim: true, default: "" },
    parentEmail: { type: String, default: "", trim: true },
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
      default: "today",
    },
    /** Optional remark when marked not interested */
    notInterestedRemark: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
    },
  },
  { timestamps: true },
);

export type AllLeadDocument = InferSchemaType<typeof AllLeadSchema> & {
  _id: mongoose.Types.ObjectId;
};

const AllLeadModel =
  mongoose.models.AllLead ?? mongoose.model("AllLead", AllLeadSchema, "all_leads");

export default AllLeadModel;
