import type { PipelineStepPanelProps } from "./pipelineStepTypes";
import { PipelineStepFrame } from "./PipelineStepFrame";

/** Step 4 — Schedule workspace (content to be added). */
export function ScheduleStepPanel({ lead }: PipelineStepPanelProps) {
  return <PipelineStepFrame stepNumber={4} leadId={lead.id} />;
}
