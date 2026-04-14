"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeExamCourseEntries,
  type ExamCourseEntry,
} from "@/lib/examCourseTypes";

export function useExamCourseCatalog() {
  const [courses, setCourses] = useState<ExamCourseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/exam-courses", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        courses?: unknown;
        error?: string;
      };
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Could not load courses.",
        );
        setCourses([]);
        return;
      }
      setCourses(normalizeExamCourseEntries(data.courses));
    } catch {
      setError("Could not load courses.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byExam = useMemo(() => {
    const m = new Map<string, ExamCourseEntry[]>();
    for (const c of courses) {
      const list = m.get(c.examValue) ?? [];
      list.push(c);
      m.set(c.examValue, list);
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
    }
    return m;
  }, [courses]);

  return {
    courses,
    byExam,
    loading,
    error,
    reload: load,
  };
}
