/** Comma-separated targets for table cells, badges, CSV. */
export function formatTargetExams(exams: string[] | undefined | null): string {
  if (!exams?.length) return "—";
  return exams.join(", ");
}
