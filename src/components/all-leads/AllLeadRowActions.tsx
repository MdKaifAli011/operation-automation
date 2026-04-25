"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ActionType = "course_brochure" | "bank_details" | "fee_details";

type Props = {
  onAction: (action: ActionType) => void;
};

export function AllLeadRowActions({ onAction }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
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

  const handleButtonClick = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 232,
      });
    }
    setOpen((v) => !v);
  };

  const actions: { key: ActionType; label: string; icon: React.ReactNode }[] = [
    {
      key: "course_brochure",
      label: "Course Brochure",
      icon: <CourseBrochureIcon />,
    },
    {
      key: "bank_details",
      label: "Bank Details",
      icon: <BankDetailsIcon />,
    },
    {
      key: "fee_details",
      label: "Fee Details",
      icon: <FeeDetailsIcon />,
    },
  ];

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none border border-slate-200 text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Send details"
        onClick={handleButtonClick}
      >
        <IconDotsVertical title="Send details" />
      </button>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              role="menu"
              className="fixed z-[250] min-w-[14.5rem] rounded-none border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
              style={{
                top: position.top,
                left: position.left,
              }}
            >
              {actions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    setPosition(null);
                    onAction(action.key);
                  }}
                >
                  <span className="shrink-0 text-slate-500">{action.icon}</span>
                  {action.label}
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

function CourseBrochureIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function BankDetailsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function FeeDetailsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
