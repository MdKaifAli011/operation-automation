import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { PipelineMetaSchema } from "@/models/leadPipelineMetaSchema";

const sheetTabs = [
  "today",
  "ongoing",
  "followup",
  "not_interested",
  "converted",
] as const;
const rowTones = [
  "interested",
  "not_interested",
  "followup_later",
  "new",
  "called_no_response",
] as const;

/**
 * Lead = one student row in CRM. All details below live in MongoDB (collection `leads`).
 *
 * - Core CRM: name, phone, exams, sheet tab, tone, follow-up date
 * - `pipelineMeta`: demos (each class row, invites), brochure, fees (incl. installments & sends), schedule
 * - `activityLog`: timeline of actions
 * - `workspaceNotes`: team notes
 * - `callHistory`: logged calls
 */
const LeadSchema = new Schema(
  {
    date: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    followUpDate: { type: String, default: null },
    studentName: { type: String, trim: true, default: "Unknown" },
    parentName: { type: String, default: "", trim: true },
    dataType: { type: String, trim: true, default: "Organic" },
    grade: { type: String, trim: true, default: "12th" },
    targetExams: { type: [String], default: [] },
    country: { type: String, default: "India", trim: true },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, default: "", trim: true },
    pipelineSteps: { type: Number, default: 0, min: 0, max: 4 },
    /**
     * All workspace data: demos (list + send info), brochure, fees (amounts,
     * installments, sends), schedule. Persisted in MongoDB — not localStorage.
     */
    pipelineMeta: {
      type: PipelineMetaSchema,
      default: () => ({}),
    },
    activityLog: {
      type: [
        {
          at: { type: String, required: true },
          kind: { type: String, required: true },
          message: { type: String, required: true },
        },
      ],
      default: [],
    },
    workspaceNotes: { type: String, default: "" },
    callHistory: {
      type: [
        {
          at: { type: String, required: true },
          outcome: { type: String, default: "" },
          duration: { type: String, default: "" },
          notes: { type: String, default: "" },
        },
      ],
      default: [],
    },
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
    /** Optional reason when marked not interested (lead sheet). */
    notInterestedRemark: {
      type: String,
      default: null,
      trim: true,
      maxlength: 2000,
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
