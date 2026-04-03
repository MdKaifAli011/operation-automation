"use client";

const STEPS = ["Demo", "Brochure", "Fees", "Enrollment", "Schedule"] as const;

export function PipelineDots({ completed }: { completed: number }) {
  const n = Math.min(5, Math.max(0, completed));
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-0.5" role="img" aria-label={`${n} of 5 steps`}>
        {STEPS.map((label, i) => (
          <span
            key={label}
            title={label}
            className={
              i < n
                ? "text-[#2e7d32] select-none"
                : "text-[#bdbdbd] select-none"
            }
            aria-label={label}
          >
            ●
          </span>
        ))}
      </div>
      <span className="text-[11px] text-[#757575]">{n}/5 steps</span>
    </div>
  );
}
