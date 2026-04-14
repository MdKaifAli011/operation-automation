import type { ReactNode } from "react";

type PipelineStepFrameProps = {
  /** 1–4 — must match the step tab `pipeline-tab-${stepNumber}` */
  stepNumber: number;
  /** Current lead — surfaced for tests and future step logic */
  leadId: string;
  children?: ReactNode;
};

/**
 * Shared shell for pipeline workspace panels: flex growth, min height, tabpanel semantics.
 */
export function PipelineStepFrame({
  stepNumber,
  leadId,
  children,
}: PipelineStepFrameProps) {
  return (
    <div
      className="flex-1 min-h-[min(60vh,520px)] bg-slate-50/60"
      role="tabpanel"
      id={`pipeline-panel-${stepNumber}`}
      aria-labelledby={`pipeline-tab-${stepNumber}`}
      aria-label={`Step ${stepNumber} workspace`}
      data-lead-id={leadId}
    >
      {children}
    </div>
  );
}
