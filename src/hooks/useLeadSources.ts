"use client";

import { useCallback, useEffect, useState } from "react";
import {
  normalizeLeadSources,
  type LeadSourceOption,
} from "@/lib/leadSources";

const LEAD_SOURCES_CACHE_TTL_MS = 5 * 60_000;
let leadSourcesCache: { data: LeadSourceOption[]; fetchedAt: number } | null =
  null;
let leadSourcesInFlight: Promise<LeadSourceOption[]> | null = null;

function hasFreshLeadSourcesCache() {
  if (!leadSourcesCache) return false;
  return Date.now() - leadSourcesCache.fetchedAt < LEAD_SOURCES_CACHE_TTL_MS;
}

function writeLeadSourcesCache(data: LeadSourceOption[]) {
  leadSourcesCache = { data, fetchedAt: Date.now() };
}

async function fetchLeadSourcesFromApi() {
  const res = await fetch("/api/settings/lead-sources", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load lead sources.");
  const data = (await res.json()) as { sources?: unknown };
  return normalizeLeadSources(data.sources);
}

async function getLeadSourcesCached(force = false) {
  if (!force && hasFreshLeadSourcesCache() && leadSourcesCache) {
    return leadSourcesCache.data;
  }
  if (!force && leadSourcesInFlight) return leadSourcesInFlight;
  leadSourcesInFlight = fetchLeadSourcesFromApi()
    .then((data) => {
      writeLeadSourcesCache(data);
      return data;
    })
    .finally(() => {
      leadSourcesInFlight = null;
    });
  return leadSourcesInFlight;
}

export function useLeadSources(): LeadSourceOption[] {
  const [sources, setSources] = useState<LeadSourceOption[]>(
    () => leadSourcesCache?.data ?? [],
  );

  const load = useCallback(async (force = false) => {
    try {
      const data = await getLeadSourcesCached(force);
      setSources(data);
    } catch {
      /* leave empty until a successful load */
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return sources;
}
