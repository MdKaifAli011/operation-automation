import { cn } from "@/lib/cn";

type IconProps = { className?: string; title?: string };

export function IconClipboard({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </svg>
  );
}

/** Fee / payments */
export function IconWallet({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4h-3z" />
    </svg>
  );
}

export function IconGraduationCap({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M22 10v6M12 12L2 7l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

export function IconBookOpen({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

export function IconFileText({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function IconLandmark({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
    </svg>
  );
}

export function IconUserPlus({ className, title }: IconProps) {
  return (
    <svg
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      {title ? <title>{title}</title> : null}
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  );
}

export function IconPhone({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4 shrink-0", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function IconBookMarked({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4 shrink-0 text-[#1565c0]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4 shrink-0 text-[#757575]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4 shrink-0 text-[#757575]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconPencil({ className }: IconProps) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function IconTrash({ className }: IconProps) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" />
    </svg>
  );
}

export function IconLink({ className }: IconProps) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
      <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
    </svg>
  );
}

export function IconCalendarLarge({ className }: IconProps) {
  return (
    <svg className={cn("h-14 w-14 text-[#bdbdbd]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconCloudUpload({ className }: IconProps) {
  return (
    <svg className={cn("h-8 w-8 text-[#757575]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      <path d="M12 13v8M9 16l3-3 3 3" />
    </svg>
  );
}

export function IconSparkles({ className }: IconProps) {
  return (
    <svg className={cn("inline h-4 w-4", className)} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.2 4.2L17 7l-3.8 1.8L12 13l-1.2-4.2L7 7l3.8-1.8L12 2zM5 14l.8 2.8L8 18l-2.2 1.2L5 22l-.8-2.8L2 18l2.2-1.2L5 14zM19 3l.5 1.8L21 5l-1.5.7L19 7l-.5-1.8L17 5l1.5-.7L19 3z" />
    </svg>
  );
}

export function IconMail({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg
      className={cn("h-3 w-3 shrink-0", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function IconCircleDot({
  className,
  color,
}: IconProps & { color?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-2 w-2 rounded-full",
        color ?? "bg-[#1565c0]",
        className,
      )}
      aria-hidden
    />
  );
}

export function IconPlus({ className }: IconProps) {
  return (
    <svg className={cn("h-4 w-4", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
