import mongoose, { Schema, type InferSchemaType } from "mongoose";

const ScheduleDateRuleSchema = new Schema(
  {
    kind: { type: String, required: true, enum: ["offset_days", "month_year", "month_week", "exact_date"] },
    days: { type: Number, default: undefined },
    yearOffset: { type: Number, default: undefined },
    month: { type: Number, default: undefined },
    weekLabel: { type: String, default: undefined },
    day: { type: Number, default: undefined },
  },
  { _id: false },
);

const WeeklySessionRowSchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    sessionLabel: { type: String, required: true, trim: true, maxlength: 80 },
    day: { type: String, required: true, trim: true, maxlength: 40 },
    timeIST: { type: String, required: true, trim: true, maxlength: 64 },
    subject: { type: String, required: true, trim: true, maxlength: 80 },
    sessionDuration: { type: String, required: true, trim: true, maxlength: 64 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const MilestoneRowSchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    milestone: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 280 },
    dateRule: { type: ScheduleDateRuleSchema, required: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const ScheduleTemplateEntrySchema = new Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 64 },
    examValue: { type: String, required: true, trim: true, maxlength: 64 },
    programmeName: { type: String, required: true, trim: true, maxlength: 120 },
    programmeDurationValue: { type: Number, required: true, min: 1, max: 999, default: 1 },
    programmeDurationUnit: { type: String, required: true, enum: ["years", "hours"], default: "years" },
    targetExamLabel: { type: String, required: true, trim: true, maxlength: 180 },
    weeklySessionStructure: { type: [WeeklySessionRowSchema], default: [] },
    milestones: { type: [MilestoneRowSchema], default: [] },
    guidelines: {
      generalGuidelines: { type: [String], default: [] },
      mockTestsRevision: { type: [String], default: [] },
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false },
);

const ScheduleTemplateCatalogSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    templates: { type: [ScheduleTemplateEntrySchema], default: [] },
  },
  { timestamps: true },
);

export type ScheduleTemplateCatalogDocument = InferSchemaType<
  typeof ScheduleTemplateCatalogSchema
> & {
  _id: mongoose.Types.ObjectId;
};

const ScheduleTemplateCatalogModel =
  mongoose.models.ScheduleTemplateCatalog ??
  mongoose.model(
    "ScheduleTemplateCatalog",
    ScheduleTemplateCatalogSchema,
    "schedule_template_catalog",
  );

export default ScheduleTemplateCatalogModel;
