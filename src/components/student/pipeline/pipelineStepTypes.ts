import type { Lead } from "@/lib/types";

/** Props every pipeline step panel receives — extend per step when you add fields. */
export type PipelineStepPanelProps = {
  lead: Lead;
};
