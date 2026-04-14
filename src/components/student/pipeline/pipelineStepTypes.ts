import type { Lead } from "@/lib/types";

/** Props every pipeline step panel receives — extend per step when you add fields. */
export type PipelineStepPanelProps = {
  lead: Lead;
};

/** Demo step needs PATCH + refresh + exam labels for scheduling UI. */
export type DemoStepPanelProps = PipelineStepPanelProps & {
  onPatchLead: (updates: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
  labelForTargetExam: (value: string) => string;
  canonicalTargetExams: readonly string[];
};
