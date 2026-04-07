export function normalizeTeacherKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
