import connectDB from "@/lib/mongodb";
import {
  normalizeExamSubjectEntries,
  type ExamSubjectEntry,
} from "@/lib/examSubjectTypes";
import ExamSubjectCatalogModel from "@/models/ExamSubjectCatalog";

const KEY = "default";

export async function loadExamSubjectCatalog(): Promise<ExamSubjectEntry[]> {
  await connectDB();
  const doc = await ExamSubjectCatalogModel.findOne({ key: KEY }).lean().exec();
  return normalizeExamSubjectEntries(doc?.subjects);
}
