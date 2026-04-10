"use client";

import { useCallback, useEffect, useState } from "react";
import {
  normalizeLeadSources,
  type LeadSourceOption,
} from "@/lib/leadSources";

export function useLeadSources(): LeadSourceOption[] {
  const [sources, setSources] = useState<LeadSourceOption[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/lead-sources", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { sources?: unknown };
      setSources(normalizeLeadSources(data.sources));
    } catch {
      /* leave empty until a successful load */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return sources;
}
