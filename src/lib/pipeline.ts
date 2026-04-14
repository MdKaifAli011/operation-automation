import type { Lead, PipelineActivity } from "./types";

export const PIPELINE_STEP_LABELS = [
  "Demo",
  "Documents",
  "Fees",
  "Schedule",
] as const;

const NESTED_META_KEYS = [
  "demo",
  "brochure",
  "studentReport",
  "fees",
  "schedule",
] as const;

/** Derive 0–4 pipeline steps from stored pipelineMeta (single source of truth). */
export function computePipelineStepsFromMeta(
  meta: Record<string, unknown> | null | undefined,
): number {
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? meta
      : {};
  const demo = m.demo as { rows?: unknown[] } | undefined;
  const rows = Array.isArray(demo?.rows) ? demo!.rows! : [];
  /** Step 1 counts as done only after at least one trial class is marked Completed (conducted). */
  const hasConductedDemo = rows.some((r) => {
    const st =
      r && typeof r === "object" && !Array.isArray(r)
        ? String((r as { status?: string }).status ?? "").trim()
        : "";
    return st === "Completed";
  });
  if (!hasConductedDemo) return 0;

  const sr = m.studentReport as { pdfUrl?: string | null } | undefined;
  const studentReportDone = !!sr?.pdfUrl && String(sr.pdfUrl).trim().length > 0;

  const br = m.brochure as {
    generated?: boolean;
    sentEmail?: boolean;
    fileName?: string | null;
    storedFileUrl?: string | null;
    documentUrl?: string | null;
  } | undefined;
  const brochureDone =
    studentReportDone ||
    !!br?.generated ||
    !!br?.sentEmail ||
    (!!br?.fileName && String(br.fileName).trim().length > 0) ||
    (!!br?.storedFileUrl && String(br.storedFileUrl).trim().length > 0) ||
    (!!br?.documentUrl && String(br.documentUrl).trim().length > 0);
  if (!brochureDone) return 1;

  const fees = m.fees as {
    feeSentEmail?: boolean;
    enrollmentSent?: boolean;
  } | undefined;
  const feesDone =
    !!fees?.feeSentEmail ||
    !!fees?.enrollmentSent;
  if (!feesDone) return 2;

  const sch = m.schedule as {
    scheduleSentEmail?: boolean;
  } | undefined;
  const scheduleDone = !!sch?.scheduleSentEmail;
  if (!scheduleDone) return 3;

  return 4;
}

/** Step numbers 1–4. User can open step `s` only if previous steps are done (`completed >= s - 1`). */
export function canAccessPipelineStep(completed: number, step: number): boolean {
  if (step < 1 || step > 4) return false;
  if (step === 1) return true;
  return completed >= step - 1;
}

/** Next step in footer: only if current step is completed. */
export function canGoToNextPipelineStep(completed: number, activeStep: number): boolean {
  return activeStep < 4 && completed >= activeStep;
}

/**
 * After marking step `stepIndex` (1–4) complete, new completed count.
 * Cannot skip ahead (e.g. cannot go to 2 if still 0).
 */
export function nextPipelineStepsAfterComplete(
  current: number,
  stepIndex: number,
): number {
  if (stepIndex < 1 || stepIndex > 4) return current;
  if (stepIndex > current + 1) return current;
  return Math.max(current, stepIndex);
}

export function appendActivity(
  current: PipelineActivity[] | undefined,
  kind: PipelineActivity["kind"],
  message: string,
): PipelineActivity[] {
  const entry: PipelineActivity = {
    at: new Date().toISOString(),
    kind,
    message,
  };
  return [entry, ...(current ?? [])];
}

/**
 * When replacing `demo.rows`, merge each incoming row with the existing row for the same
 * `meetRowId` so a stale client cannot wipe fields (e.g. meetLinkUrl) after a status-only update.
 */
function mergeDemoRowsByMeetRowId(
  existing: unknown[] | undefined,
  incoming: unknown[] | undefined,
): unknown[] {
  if (!Array.isArray(incoming)) {
    return Array.isArray(existing) ? [...existing] : [];
  }
  const prevById = new Map<string, Record<string, unknown>>();
  if (Array.isArray(existing)) {
    for (const raw of existing) {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const row = raw as Record<string, unknown>;
        const id = String(row.meetRowId ?? "").trim();
        if (id) prevById.set(id, { ...row });
      }
    }
  }
  return incoming.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const inc = raw as Record<string, unknown>;
    const id = String(inc.meetRowId ?? "").trim();
    if (!id) return { ...inc };
    const prev = prevById.get(id);
    return prev ? { ...prev, ...inc } : { ...inc };
  });
}

/** Deep-merge nested step buckets (demo, brochure, fees, schedule). */
export function mergePipelineMeta(
  current: Lead["pipelineMeta"],
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...current }
      : {};
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (
      NESTED_META_KEYS.includes(k as (typeof NESTED_META_KEYS)[number]) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      const prev =
        out[k] &&
        typeof out[k] === "object" &&
        !Array.isArray(out[k])
          ? (out[k] as Record<string, unknown>)
          : {};
      const patchNested = v as Record<string, unknown>;
      if (k === "demo" && Array.isArray(patchNested.rows)) {
        const mergedRows = mergeDemoRowsByMeetRowId(
          Array.isArray(prev.rows) ? (prev.rows as unknown[]) : undefined,
          patchNested.rows as unknown[],
        );
        out[k] = { ...prev, ...patchNested, rows: mergedRows };
      } else {
        out[k] = { ...prev, ...patchNested };
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}
