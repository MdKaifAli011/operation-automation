import type { PipelineStepPanelProps } from "./pipelineStepTypes";
import { PipelineStepFrame } from "./PipelineStepFrame";

/** Step 3 — Fees workspace (content to be added). */
export function FeesStepPanel({ lead }: PipelineStepPanelProps) {
  return <PipelineStepFrame stepNumber={3} leadId={lead.id} />;
}
