import type { PipelineStepPanelProps } from "./pipelineStepTypes";
import { PipelineStepFrame } from "./PipelineStepFrame";

/** Step 1 — Demo workspace (content to be added). */
export function DemoStepPanel({ lead }: PipelineStepPanelProps) {
  return <PipelineStepFrame stepNumber={1} leadId={lead.id} />;
}
