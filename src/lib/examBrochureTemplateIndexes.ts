/**
 * Migrates legacy unique index `{ exam: 1 }` -> `{ exam: 1, courseId: 1 }`.
 * Safe to call repeatedly before brochure template writes.
 */
export async function ensureExamBrochureTemplateIndexes(
  model: any,
): Promise<void> {
  const col = model?.collection as
    | {
        indexes: (options?: any) => Promise<
          Array<{ name?: string; key?: Record<string, number>; unique?: boolean }>
        >;
        dropIndex: (name: string) => Promise<unknown>;
        createIndex: (
          keys: Record<string, number>,
          opts?: { name?: string; unique?: boolean },
        ) => Promise<string>;
      }
    | undefined;
  if (!col) return;
  const indexes = await col.indexes({ full: true }).catch(() => []);
  const legacy = indexes.find((idx) => idx.name === "exam_1");
  const isLegacyExamOnly =
    legacy &&
    legacy.unique === true &&
    !!legacy.key &&
    Object.keys(legacy.key).length === 1 &&
    legacy.key.exam === 1;
  if (isLegacyExamOnly) {
    await col.dropIndex("exam_1").catch(() => {});
  }
  const hasCompound = indexes.some((idx) => idx.name === "exam_1_courseId_1");
  if (!hasCompound) {
    await col
      .createIndex(
        { exam: 1, courseId: 1 },
        { name: "exam_1_courseId_1", unique: true },
      )
      .catch(() => {});
  }
}
