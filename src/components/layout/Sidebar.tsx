"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBookOpen,
  IconClipboard,
  IconFileText,
  IconGlobe,
  IconGraduationCap,
  IconLandmark,
  IconLink,
  IconMail,
  IconSettings,
  IconUserPlus,
  IconWallet,
} from "@/components/icons/CrmIcons";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Lead Management", Icon: IconClipboard },
  { href: "/fee-management", label: "Fee Management", Icon: IconWallet },
  { href: "/faculties", label: "Faculties", Icon: IconGraduationCap },
  { href: "/subjects", label: "Subjects", Icon: IconBookOpen },
  { href: "/course-brochure", label: "Course Brochure", Icon: IconFileText },
  { href: "/email-templates", label: "Email Templates", Icon: IconMail },
  { href: "/meet-links", label: "Meet links", Icon: IconLink },
  { href: "/time-zones", label: "Time zones", Icon: IconGlobe },
  {
    href: "/settings/lead-sources",
    label: "Lead sources",
    Icon: IconSettings,
  },
  { href: "/bank-details", label: "Bank & A/c Details", Icon: IconLandmark },
  { href: "/enroll-student", label: "Enroll Student", Icon: IconUserPlus },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "group/sidebar fixed left-0 top-0 z-40 flex h-full flex-col border-r border-slate-200/90 bg-white/95 shadow-[2px_0_12px_-4px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-[width] duration-200 ease-out",
        "w-[var(--sidebar-collapsed)] hover:w-[var(--sidebar-expanded)] max-md:w-[var(--sidebar-collapsed)] max-md:hover:w-[var(--sidebar-collapsed)]",
      )}
      style={{ transitionProperty: "width" }}
    >
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-x-hidden px-1.5 py-3"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/students")
              : pathname.startsWith(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex min-h-[44px] items-center gap-3 rounded-none px-2.5 text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-sky-50 text-primary before:absolute before:left-0 before:top-1/2 before:h-[32px] before:w-[3px] before:-translate-y-1/2 before:rounded-none before:bg-primary"
                  : "text-slate-700 hover:bg-slate-50 max-md:text-slate-500",
              )}
            >
              <span
                className={cn(
                  "flex w-9 shrink-0 justify-center",
                  active
                    ? "text-primary"
                    : "text-slate-400 group-hover/sidebar:text-slate-600",
                )}
              >
                <Icon title={item.label} />
              </span>
              <span className="hidden min-w-0 truncate whitespace-nowrap group-hover/sidebar:inline max-md:hidden">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
