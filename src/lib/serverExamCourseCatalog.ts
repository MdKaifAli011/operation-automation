import connectDB from "@/lib/mongodb";
import {
  normalizeExamCourseEntries,
  type ExamCourseEntry,
} from "@/lib/examCourseTypes";
import ExamCourseCatalogModel from "@/models/ExamCourseCatalog";

const SETTINGS_KEY = "default";

export async function getExamCourseCatalog(): Promise<ExamCourseEntry[]> {
  await connectDB();
  const doc = await ExamCourseCatalogModel.findOne({ key: SETTINGS_KEY })
    .lean()
    .exec();
  return normalizeExamCourseEntries(doc?.courses);
}
