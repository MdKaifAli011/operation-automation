"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeExamSubjectEntries,
  type ExamSubjectEntry,
} from "@/lib/examSubjectTypes";

const EXAM_SUBJECTS_CACHE_TTL_MS = 5 * 60_000;
let examSubjectsCache: { data: ExamSubjectEntry[]; fetchedAt: number } | null =
  null;
let examSubjectsInFlight: Promise<ExamSubjectEntry[]> | null = null;

function hasFreshExamSubjectsCache() {
  if (!examSubjectsCache) return false;
  return Date.now() - examSubjectsCache.fetchedAt < EXAM_SUBJECTS_CACHE_TTL_MS;
}

function writeExamSubjectsCache(data: ExamSubjectEntry[]) {
  examSubjectsCache = { data, fetchedAt: Date.now() };
}

async function fetchExamSubjectsFromApi() {
  const res = await fetch("/api/settings/exam-subjects", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    subjects?: unknown;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not load subjects.",
    );
  }
  return normalizeExamSubjectEntries(data.subjects);
}

async function getExamSubjectsCached(force = false) {
  if (!force && hasFreshExamSubjectsCache() && examSubjectsCache) {
    return examSubjectsCache.data;
  }
  if (!force && examSubjectsInFlight) return examSubjectsInFlight;
  examSubjectsInFlight = fetchExamSubjectsFromApi()
    .then((data) => {
      writeExamSubjectsCache(data);
      return data;
    })
    .finally(() => {
      examSubjectsInFlight = null;
    });
  return examSubjectsInFlight;
}

export function useExamSubjectCatalog() {
  const [subjects, setSubjects] = useState<ExamSubjectEntry[]>(
    () => examSubjectsCache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !examSubjectsCache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExamSubjectsCached(force);
      setSubjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load subjects.");
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
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
    reload: () => load(true),
  };
}
