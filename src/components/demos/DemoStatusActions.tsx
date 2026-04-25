"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type DemoStatus = "Scheduled" | "Cancelled" | "Completed";

type Demo = {
  leadId: string;
  studentName: string;
  status: DemoStatus;
};

type Props = {
  demo: Demo;
  onStatusChange: (status: DemoStatus) => void;
};

export function DemoStatusActions({ demo, onStatusChange }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      // Don't close if clicking inside the dropdown (even though it's portaled)
      const dropdown = document.querySelector('[role="menu"]');
      if (dropdown?.contains(e.target as Node)) return;
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setPosition(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setPosition(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const availableStatuses: DemoStatus[] = (["Scheduled", "Cancelled", "Completed"] as DemoStatus[]).filter(
    (s) => s !== demo.status
  );

  const handleButtonClick = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 232, // min-w-[14.5rem] = 232px
      });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-slate-200 text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Change status"
        onClick={handleButtonClick}
      >
        <IconDotsVertical title="Change status" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              role="menu"
              className={cn(
                "fixed z-[250] min-w-[14.5rem] rounded-none border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10",
              )}
              style={{
                top: position.top,
                left: position.left,
              }}
            >
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    setPosition(null);
                    onStatusChange(status);
                  }}
                >
                  <StatusIcon status={status} className="shrink-0 text-slate-500" />
                  Mark as {status}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function IconDotsVertical({ title }: { title?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-slate-600"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}

function StatusIcon({ status, className }: { status: DemoStatus; className?: string }) {
  if (status === "Scheduled") {
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
          d="M12 2v6m0 0v6m0-6h6m-6 0H6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "Cancelled") {
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
          d="M18 6L6 18M6 6l12 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === "Completed") {
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
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return null;
}
