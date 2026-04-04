import mongoose, { Schema, type InferSchemaType } from "mongoose";

const FacultySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    subjects: { type: [String], default: [] },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    qualification: { type: String, default: "", trim: true },
    experience: { type: Number, default: 0 },
    joined: { type: String, default: "" },
  },
  { timestamps: true },
);

export type FacultyDocument = InferSchemaType<typeof FacultySchema> & {
  _id: mongoose.Types.ObjectId;
};

const FacultyModel =
  mongoose.models.Faculty ??
  mongoose.model("Faculty", FacultySchema, "faculties");

export default FacultyModel;
