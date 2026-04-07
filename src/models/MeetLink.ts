import mongoose, { Schema, type InferSchemaType } from "mongoose";

const MeetLinkSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    label: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type MeetLinkDocument = InferSchemaType<typeof MeetLinkSchema> & {
  _id: mongoose.Types.ObjectId;
};

const MeetLinkModel =
  mongoose.models.MeetLink ??
  mongoose.model("MeetLink", MeetLinkSchema, "meet_links");

export default MeetLinkModel;
