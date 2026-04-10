"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeExamSubjectEntries,
  type ExamSubjectEntry,
} from "@/lib/examSubjectTypes";

export function useExamSubjectCatalog() {
  const [subjects, setSubjects] = useState<ExamSubjectEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/exam-subjects", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        subjects?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not load subjects.",
        );
        setSubjects([]);
        return;
      }
      setSubjects(normalizeExamSubjectEntries(data.subjects));
    } catch {
      setError("Could not load subjects.");
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byExam = useMemo(() => {
    const m = new Map<string, ExamSubjectEntry[]>();
    for (const s of subjects) {
      const list = m.get(s.examValue) ?? [];
      list.push(s);
      m.set(s.examValue, list);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    return m;
  }, [subjects]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.name);
    return m;
  }, [subjects]);

  const activeSubjectIds = useMemo(() => {
    const s = new Set<string>();
    for (const x of subjects) {
      if (x.isActive !== false) s.add(x.id);
    }
    return s;
  }, [subjects]);

  return {
    subjects,
    byExam,
    nameById,
    activeSubjectIds,
    loading,
    error,
    reload: load,
  };
}
