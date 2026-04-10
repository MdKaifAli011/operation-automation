import connectDB from "@/lib/mongodb";
import {
  activeTargetExamValues,
  FALLBACK_TARGET_EXAM_VALUES,
  normalizeTargetExams,
} from "@/lib/targetExams";
import TargetExamSettingsModel from "@/models/TargetExamSettings";

const SETTINGS_KEY = "default";

/**
 * Active exam `value` strings in sort order — for API validation and fee/brochure rows.
 */
export async function getActiveTargetExamValues(): Promise<string[]> {
  try {
    await connectDB();
    const doc = await TargetExamSettingsModel.findOne({ key: SETTINGS_KEY })
      .lean()
      .exec();
    const list = normalizeTargetExams(doc?.exams);
    const active = activeTargetExamValues(list);
    return active.length > 0 ? active : [...FALLBACK_TARGET_EXAM_VALUES];
  } catch {
    return [...FALLBACK_TARGET_EXAM_VALUES];
  }
}
