import mongoose, { Schema, type InferSchemaType } from "mongoose";

const emailJobStatus = ["pending", "processing", "completed", "failed"] as const;

/**
 * Email queue for batch email sending
 * Jobs are processed one by one by the worker
 */
const EmailQueueSchema = new Schema(
  {
    leadId: {
      type: String,
      required: true,
      index: true,
    },
    leadName: {
      type: String,
      required: true,
    },
    toEmail: {
      type: String,
      required: true,
    },
    actions: {
      type: [String],
      required: true,
    },
    brochureEmail: {
      selectionKeys: [String],
      includeStudentReportPdf: Boolean,
    },
    status: {
      type: String,
      enum: emailJobStatus,
      default: "pending",
    },
    error: {
      type: String,
      default: null,
      trim: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Index for processing order (oldest first)
EmailQueueSchema.index({ status: 1, createdAt: 1 });

export type EmailQueueDocument = InferSchemaType<typeof EmailQueueSchema> & {
  _id: mongoose.Types.ObjectId;
};

const EmailQueueModel =
  mongoose.models.EmailQueue ??
  mongoose.model("EmailQueue", EmailQueueSchema, "email_queue");

export default EmailQueueModel;
