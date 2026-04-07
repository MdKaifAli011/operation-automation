/** Minutes after demo start (IST) before staff can invite teacher feedback. Default 45. */
export function getDemoTeacherFeedbackAfterMinutes(): number {
  const raw = process.env.DEMO_TEACHER_FEEDBACK_AFTER_MINUTES?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 5 && n <= 24 * 60) return n;
  }
  return 45;
}
