/** Minutes after demo start (IST) when status becomes Completed automatically. Default 5 hours. */
export function getDemoAutoCompleteAfterMinutes(): number {
  const raw = process.env.DEMO_AUTO_COMPLETE_AFTER_MINUTES?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0 && n <= 24 * 60) return n;
  }
  return 300;
}

/** Teacher cannot overlap another demo within this window from scheduled start (default 2 hours). */
export function getTeacherBlockDurationMinutes(): number {
  const raw = process.env.TEACHER_DEMO_BLOCK_MINUTES?.trim();
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0 && n <= 24 * 60) return n;
  }
  return 120;
}
