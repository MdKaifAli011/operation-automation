"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeTargetExams,
  activeTargetExamValues,
  type TargetExamOption,
} from "@/lib/targetExams";

const TARGET_EXAMS_CACHE_TTL_MS = 5 * 60_000;
let targetExamsCache: { data: TargetExamOption[]; fetchedAt: number } | null =
  null;
let targetExamsInFlight: Promise<TargetExamOption[]> | null = null;

function hasFreshTargetExamsCache() {
  if (!targetExamsCache) return false;
  return Date.now() - targetExamsCache.fetchedAt < TARGET_EXAMS_CACHE_TTL_MS;
}

function writeTargetExamsCache(data: TargetExamOption[]) {
  targetExamsCache = { data, fetchedAt: Date.now() };
}

async function fetchTargetExamsFromApi() {
  const res = await fetch("/api/settings/target-exams", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load target exams.");
  const data = (await res.json()) as { exams?: unknown };
  return normalizeTargetExams(data.exams);
}

async function getTargetExamsCached(force = false) {
  if (!force && hasFreshTargetExamsCache() && targetExamsCache) {
    return targetExamsCache.data;
  }
  if (!force && targetExamsInFlight) return targetExamsInFlight;
  targetExamsInFlight = fetchTargetExamsFromApi()
    .then((data) => {
      writeTargetExamsCache(data);
      return data;
    })
    .finally(() => {
      targetExamsInFlight = null;
    });
  return targetExamsInFlight;
}

export function useTargetExamOptions() {
  const [exams, setExams] = useState<TargetExamOption[]>(
    () => targetExamsCache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !targetExamsCache);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await getTargetExamsCached(force);
      setExams(data);
    } catch {
      /* leave empty until a successful load */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const activeValues = useMemo(() => activeTargetExamValues(exams), [exams]);

  const labelFor = useCallback(
    (value: string) => exams.find((e) => e.value === value)?.label ?? value,
    [exams],
  );

  const reload = useCallback(async () => {
    await load(true);
  }, [load]);

  return { exams, activeValues, labelFor, loading, reload };
}
