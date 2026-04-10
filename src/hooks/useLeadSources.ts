"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LEAD_SOURCE_OPTIONS,
  normalizeLeadSources,
  type LeadSourceOption,
} from "@/lib/leadSources";

export function useLeadSources(): LeadSourceOption[] {
  const [sources, setSources] = useState<LeadSourceOption[]>(() =>
    DEFAULT_LEAD_SOURCE_OPTIONS.map((o) => ({ ...o })),
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/lead-sources", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { sources?: unknown };
      setSources(normalizeLeadSources(data.sources));
    } catch {
      /* keep defaults */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return sources;
}
