"use client";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-4 shadow-sm shadow-slate-900/[0.04] backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="bg-gradient-to-r from-primary to-[#0d47a1] bg-clip-text text-xl font-semibold tracking-tight text-transparent">
          Testprepkart
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative rounded-none p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-none bg-[#c62828] px-0.5 text-[10px] font-medium text-white">
            3
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-none bg-gradient-to-br from-primary to-[#0d47a1] text-sm font-medium text-white shadow-sm"
            aria-hidden
          >
            A
          </span>
          <span className="text-sm font-medium text-slate-800">Admin</span>
        </div>
      </div>
    </header>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
