import mongoose, { Schema } from "mongoose";

const BankAccountSchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    label: { type: String, default: "", trim: true, maxlength: 120 },
    bankName: { type: String, default: "", trim: true, maxlength: 120 },
    accountHolderName: { type: String, default: "", trim: true, maxlength: 120 },
    accountNumber: { type: String, default: "", trim: true, maxlength: 40 },
    ifsc: { type: String, default: "", trim: true, maxlength: 20 },
    branch: { type: String, default: "", trim: true, maxlength: 120 },
    accountType: {
      type: String,
      enum: ["Current", "Savings"],
      default: "Current",
    },
    upi: { type: String, default: "", trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const InstituteFieldsSchema = new Schema(
  {
    instituteName: { type: String, default: "", trim: true, maxlength: 200 },
    regNo: { type: String, default: "", trim: true, maxlength: 120 },
    gst: { type: String, default: "", trim: true, maxlength: 32 },
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

const InstituteProfileSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    institute: { type: InstituteFieldsSchema, default: () => ({}) },
    bankAccounts: { type: [BankAccountSchema], default: [] },
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
