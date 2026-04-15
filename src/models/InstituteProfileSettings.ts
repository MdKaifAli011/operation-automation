import mongoose, { Schema } from "mongoose";

const InstituteFieldsSchema = new Schema(
  {
    instituteName: { type: String, default: "", trim: true, maxlength: 200 },
    regNo: { type: String, default: "", trim: true, maxlength: 120 },
    gst: { type: String, default: "", trim: true, maxlength: 32 },
    feeGstPercent: {
      type: Number,
      default: 18,
      min: 0,
      max: 100,
    },
    inrPerUsd: { type: Number, default: 83, min: 0.0001 },
    inrPerAed: { type: Number, default: 22.5, min: 0.0001 },
    address: { type: String, default: "", trim: true, maxlength: 2000 },
    city: { type: String, default: "", trim: true, maxlength: 120 },
    state: { type: String, default: "", trim: true, maxlength: 120 },
    country: { type: String, default: "", trim: true, maxlength: 120 },
    pincode: { type: String, default: "", trim: true, maxlength: 24 },
    phone: { type: String, default: "", trim: true, maxlength: 40 },
    email: { type: String, default: "", trim: true, maxlength: 200 },
    website: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: false },
);

/** Institute legal & contact only — bank accounts live in `BankProfileSettings`. */
const InstituteProfileSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    institute: { type: InstituteFieldsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type InstituteProfileSettingsDocument = mongoose.InferSchemaType<
  typeof InstituteProfileSettingsSchema
>;

const InstituteProfileSettingsModel =
  mongoose.models.InstituteProfileSettings ??
  mongoose.model(
    "InstituteProfileSettings",
    InstituteProfileSettingsSchema,
    "institute_profile_settings",
  );

export default InstituteProfileSettingsModel;
