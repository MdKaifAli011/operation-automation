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

/** Documents step also patches lead + refreshes for send/status actions. */
export type DocumentsStepPanelProps = PipelineStepPanelProps & {
  onPatchLead: (updates: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
};

/** Fees step: save fee plan + bank selection. */
export type FeesStepPanelProps = PipelineStepPanelProps & {
  onPatchLead: (updates: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
};

/** Schedule step: save student-specific plan, generate/send actions. */
export type ScheduleStepPanelProps = PipelineStepPanelProps & {
  onPatchLead: (updates: Partial<Lead>) => Promise<Lead>;
  refreshLead: () => Promise<void>;
};
