import type { PipelineStepPanelProps } from "./pipelineStepTypes";
import { PipelineStepFrame } from "./PipelineStepFrame";

/** Step 2 — Documents workspace (content to be added). */
export function DocumentsStepPanel({ lead }: PipelineStepPanelProps) {
  return <PipelineStepFrame stepNumber={2} leadId={lead.id} />;
}
