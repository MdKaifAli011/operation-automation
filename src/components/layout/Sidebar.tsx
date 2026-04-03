"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/", label: "Lead Management", icon: "📋" },
  { href: "/fee-management", label: "Fee Management", icon: "💰" },
  { href: "/faculties", label: "Faculties", icon: "👨‍🏫" },
  { href: "/subjects", label: "Subjects", icon: "📚" },
  { href: "/course-brochure", label: "Course Brochure", icon: "📄" },
  { href: "/bank-details", label: "Bank & A/c Details", icon: "🏦" },
  { href: "/enroll-student", label: "Enroll Student", icon: "🎓" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "group/sidebar fixed left-0 top-0 z-40 flex h-full flex-col border-r border-[#e0e0e0] bg-white transition-[width] duration-150 ease-in-out",
        "w-[60px] hover:w-[150px] max-md:w-[60px] max-md:hover:w-[60px]",
      )}
      style={{ transitionProperty: "width" }}
    >
      <nav
        className="flex flex-1 flex-col gap-0.5 overflow-x-hidden px-1 py-3"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/students")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex min-h-[40px] items-center gap-2 rounded-r-md px-2 text-[13px] font-medium transition-colors duration-150",
                active
                  ? "bg-[#e3f2fd] text-[#1565c0] before:absolute before:left-0 before:top-1/2 before:h-[28px] before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-[#1565c0]"
                  : "text-[#212121] hover:bg-[#f5f5f5] max-md:text-[#757575]",
              )}
            >
              <span className="flex w-8 shrink-0 justify-center text-lg leading-none">
                {item.icon}
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
