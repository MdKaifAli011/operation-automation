"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeExamCourseEntries,
  type ExamCourseEntry,
} from "@/lib/examCourseTypes";

const EXAM_COURSES_CACHE_TTL_MS = 5 * 60_000;
let examCoursesCache: { data: ExamCourseEntry[]; fetchedAt: number } | null =
  null;
let examCoursesInFlight: Promise<ExamCourseEntry[]> | null = null;

function hasFreshExamCoursesCache() {
  if (!examCoursesCache) return false;
  return Date.now() - examCoursesCache.fetchedAt < EXAM_COURSES_CACHE_TTL_MS;
}

function writeExamCoursesCache(data: ExamCourseEntry[]) {
  examCoursesCache = { data, fetchedAt: Date.now() };
}

async function fetchExamCoursesFromApi() {
  const res = await fetch("/api/settings/exam-courses", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    courses?: unknown;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not load courses.",
    );
  }
  return normalizeExamCourseEntries(data.courses);
}

async function getExamCoursesCached(force = false) {
  if (!force && hasFreshExamCoursesCache() && examCoursesCache) {
    return examCoursesCache.data;
  }
  if (!force && examCoursesInFlight) return examCoursesInFlight;
  examCoursesInFlight = fetchExamCoursesFromApi()
    .then((data) => {
      writeExamCoursesCache(data);
      return data;
    })
    .finally(() => {
      examCoursesInFlight = null;
    });
  return examCoursesInFlight;
}

export function useExamCourseCatalog() {
  const [courses, setCourses] = useState<ExamCourseEntry[]>(
    () => examCoursesCache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !examCoursesCache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExamCoursesCached(force);
      setCourses(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load courses.");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
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
    reload: () => load(true),
  };
}
