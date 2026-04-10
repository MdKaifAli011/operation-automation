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

/** Bank accounts + default for fee step — separate from institute legal/contact details. */
const BankProfileSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    bankAccounts: { type: [BankAccountSchema], default: [] },
    defaultFeeBankAccountId: { type: String, default: null, maxlength: 64 },
  },
  { timestamps: true },
);

export type BankProfileSettingsDocument = mongoose.InferSchemaType<
  typeof BankProfileSettingsSchema
>;

const BankProfileSettingsModel =
  mongoose.models.BankProfileSettings ??
  mongoose.model(
    "BankProfileSettings",
    BankProfileSettingsSchema,
    "bank_profile_settings",
  );

export default BankProfileSettingsModel;
