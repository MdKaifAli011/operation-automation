"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeScheduleTemplateEntries,
  type ScheduleTemplateEntry,
} from "@/lib/scheduleTemplateTypes";

const CACHE_TTL_MS = 5 * 60_000;
let cache: { data: ScheduleTemplateEntry[]; fetchedAt: number } | null = null;
let inFlight: Promise<ScheduleTemplateEntry[]> | null = null;

function hasFreshCache() {
  if (!cache) return false;
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS;
}

function writeCache(data: ScheduleTemplateEntry[]) {
  cache = { data, fetchedAt: Date.now() };
}

async function fetchFromApi() {
  const res = await fetch("/api/settings/schedule-templates", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as {
    templates?: unknown;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not load schedule templates.",
    );
  }
  return normalizeScheduleTemplateEntries(data.templates);
}

async function getCached(force = false) {
  if (!force && hasFreshCache() && cache) return cache.data;
  if (!force && inFlight) return inFlight;
  inFlight = fetchFromApi()
    .then((data) => {
      writeCache(data);
      return data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useScheduleTemplates() {
  const [templates, setTemplates] = useState<ScheduleTemplateEntry[]>(
    () => cache?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !cache);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCached(force);
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedule templates.");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const byExam = useMemo(() => {
    const m = new Map<string, ScheduleTemplateEntry[]>();
    for (const t of templates) {
      const list = m.get(t.examValue) ?? [];
      list.push(t);
      m.set(t.examValue, list);
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.programmeName.localeCompare(b.programmeName),
      );
    }
    return m;
  }, [templates]);

  return {
    templates,
    byExam,
    loading,
    error,
    reload: () => load(true),
  };
}

