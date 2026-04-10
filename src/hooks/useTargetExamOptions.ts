"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeTargetExams,
  activeTargetExamValues,
  type TargetExamOption,
} from "@/lib/targetExams";

export function useTargetExamOptions() {
  const [exams, setExams] = useState<TargetExamOption[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/target-exams", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { exams?: unknown };
      setExams(normalizeTargetExams(data.exams));
    } catch {
      /* leave empty until a successful load */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeValues = useMemo(() => activeTargetExamValues(exams), [exams]);

  const labelFor = useCallback(
    (value: string) => exams.find((e) => e.value === value)?.label ?? value,
    [exams],
  );

  return { exams, activeValues, labelFor, loading, reload: load };
}
