import { TARGET_EXAM_OPTIONS } from "@/lib/constants";

/**
 * Pick one exam to resolve default fee: first match in canonical order
 * (NEET before JEE before CUET, …), then any remaining selection.
 */
export function primaryExamForFee(
  targetExams: string[] | undefined | null,
): string | null {
  const list = Array.isArray(targetExams)
    ? targetExams.filter((x) => typeof x === "string" && x.trim())
    : [];
  if (list.length === 0) return null;
  for (const opt of TARGET_EXAM_OPTIONS) {
    if (list.includes(opt)) return opt;
  }
  return list[0] ?? null;
}
