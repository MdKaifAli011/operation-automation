import mongoose, { Schema, type InferSchemaType } from "mongoose";

const FacultyAssignmentSchema = new Schema(
  {
    examValue: { type: String, required: true, trim: true, maxlength: 64 },
    subjectId: { type: String, required: true, trim: true, maxlength: 64 },
  },
  { _id: false },
);

const FacultySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /**
     * Structured teaching: which catalog subject under which exam.
     * When non-empty, API keeps `subjects` / `courses` denormalized from catalog.
     */
    assignments: { type: [FacultyAssignmentSchema], default: [] },
    subjects: { type: [String], default: [] },
    /** Target course/exam values this faculty teaches (from Exams & subjects). */
    courses: { type: [String], default: [] },
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
