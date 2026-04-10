import mongoose, { Schema } from "mongoose";

const LeadSourceRowSchema = new Schema(
  {
    abbrev: { type: String, required: true, trim: true, maxlength: 8 },
    label: { type: String, required: true, trim: true, maxlength: 64 },
    value: { type: String, required: true, trim: true, maxlength: 64 },
  },
  { _id: false },
);

const LeadSourceSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    sources: { type: [LeadSourceRowSchema], default: [] },
  },
  { timestamps: true },
);

export type LeadSourceSettingsDocument = mongoose.InferSchemaType<
  typeof LeadSourceSettingsSchema
>;

const LeadSourceSettingsModel =
  mongoose.models.LeadSourceSettings ??
  mongoose.model("LeadSourceSettings", LeadSourceSettingsSchema, "lead_source_settings");

export default LeadSourceSettingsModel;
