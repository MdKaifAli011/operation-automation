import mongoose, { Schema } from "mongoose";

const TargetExamOptionSchema = new Schema(
  {
    value: { type: String, required: true, trim: true, maxlength: 64 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: false },
);

const TargetExamSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    exams: { type: [TargetExamOptionSchema], default: [] },
  },
  { timestamps: true },
);

const TargetExamSettingsModel =
  mongoose.models.TargetExamSettings ??
  mongoose.model(
    "TargetExamSettings",
    TargetExamSettingsSchema,
    "target_exam_settings",
  );

export default TargetExamSettingsModel;
