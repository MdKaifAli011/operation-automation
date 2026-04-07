import mongoose, { Schema, type InferSchemaType } from "mongoose";

const EmailTemplateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    subject: { type: String, required: true, trim: true },
    bodyHtml: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type EmailTemplateDocument = InferSchemaType<typeof EmailTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
};

const EmailTemplateModel =
  mongoose.models.EmailTemplate ??
  mongoose.model("EmailTemplate", EmailTemplateSchema, "email_templates");

export default EmailTemplateModel;
