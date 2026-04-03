"use client";

export function Header() {
  return (
    <header className="sticky top-0 z-20 flex h-[64px] shrink-0 items-center justify-between border-b border-[#e0e0e0] bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold text-[#1565c0]">Testprepkart</span>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative rounded-md p-2 text-[#757575] transition-colors hover:bg-[#f5f5f5]"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#c62828] px-0.5 text-[10px] font-medium text-white">
            3
          </span>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1565c0] text-sm font-medium text-white"
            aria-hidden
          >
            A
          </span>
          <span className="text-sm font-medium text-[#212121]">Admin</span>
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
