"use client";

import { format } from "date-fns";
import { buildLeadCsvTemplate } from "@/lib/lead-csv";
import { cn } from "@/lib/cn";
import { SX } from "@/components/student/student-excel-ui";

export function LeadCsvTemplateButton() {
  const download = () => {
    const csv = buildLeadCsvTemplate();
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-import-template_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      className={cn(
        SX.leadBtnOutline,
        "h-9 gap-2 whitespace-nowrap px-3 text-[13px] font-semibold text-slate-800",
      )}
      onClick={download}
      title="Download a CSV with column headers and one sample row (same format as export)"
    >
      <TemplateDocIcon className="text-slate-500" />
      CSV template
    </button>
  );
}

function TemplateDocIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M8 13h8M8 17h8M8 9h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
