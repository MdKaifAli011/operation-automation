"use client";

import { cn } from "@/lib/cn";

const STEPS = ["Demo", "Brochure", "Fees", "Schedule"] as const;
const MAX = 4;

export function PipelineDots({ completed }: { completed: number }) {
  const n = Math.min(MAX, Math.max(0, completed));
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${n} of ${MAX} pipeline steps: ${STEPS.join(", ")}`}
    >
      {STEPS.map((label, i) => (
        <span
          key={label}
          title={label}
          className={cn(
            "inline-flex select-none text-xl leading-none sm:text-2xl",
            i < n ? "text-[#2e7d32]" : "text-[#bdbdbd]",
          )}
          aria-hidden
        >
          ●
        </span>
      ))}
    </div>
  );
}
