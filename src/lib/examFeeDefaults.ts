import { FALLBACK_TARGET_EXAM_VALUES } from "@/lib/targetExams";

/**
 * Pick one exam to resolve default fee: first match in `preferredOrder`
 * (from settings), then any remaining selection.
 */
export function primaryExamForFee(
  targetExams: string[] | undefined | null,
  preferredOrder?: readonly string[] | null,
): string | null {
  const list = Array.isArray(targetExams)
    ? targetExams.filter((x) => typeof x === "string" && x.trim())
    : [];
  if (list.length === 0) return null;
  const order =
    preferredOrder && preferredOrder.length > 0
      ? preferredOrder
      : FALLBACK_TARGET_EXAM_VALUES;
  for (const opt of order) {
    if (list.includes(opt)) return opt;
  }
  return list[0] ?? null;
}
