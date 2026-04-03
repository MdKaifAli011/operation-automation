"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBookOpen,
  IconClipboard,
  IconFileText,
  IconGraduationCap,
  IconLandmark,
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
  { href: "/bank-details", label: "Bank & A/c Details", Icon: IconLandmark },
  { href: "/enroll-student", label: "Enroll Student", Icon: IconUserPlus },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "group/sidebar fixed left-0 top-0 z-40 flex h-full flex-col border-r border-[#e0e0e0] bg-white transition-[width] duration-150 ease-in-out",
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
                "relative flex min-h-[44px] items-center gap-3 rounded-r-md px-2.5 text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-[#e3f2fd] text-[#1565c0] before:absolute before:left-0 before:top-1/2 before:h-[30px] before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-[#1565c0]"
                  : "text-[#212121] hover:bg-[#f5f5f5] max-md:text-[#757575]",
              )}
            >
              <span
                className={cn(
                  "flex w-9 shrink-0 justify-center",
                  active ? "text-[#1565c0]" : "text-[#9e9e9e] group-hover/sidebar:text-[#616161]",
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
