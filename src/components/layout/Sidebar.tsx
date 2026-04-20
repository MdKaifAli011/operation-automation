"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBookMarked,
  IconBookOpen,
  IconClipboard,
  IconFileText,
  IconGlobe,
  IconGraduationCap,
  IconLandmark,
  IconLink,
  IconMail,
  IconCalendar,
  IconSettings,
  IconWallet,
  IconChevronDown,
  IconChevronRight,
} from "@/components/icons/CrmIcons";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  Icon: React.FC<{ title?: string }>;
};

type NavGroup = {
  id: string;
  label: string;
  Icon: React.FC<{ title?: string }>;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "lead",
    label: "Lead Dashboard",
    Icon: IconClipboard,
    items: [{ href: "/", label: "Leads", Icon: IconClipboard }],
  },
  {
    id: "exam",
    label: "Exam Management",
    Icon: IconBookOpen,
    items: [
      { href: "/exams-subjects", label: "Exam & Subjects", Icon: IconBookOpen },
    ],
  },
  {
    id: "course",
    label: "Course Management",
    Icon: IconBookMarked,
    items: [
      { href: "/exam-courses", label: "Courses", Icon: IconBookMarked },
      { href: "/fee-management", label: "Course Fee", Icon: IconWallet },
      { href: "/course-brochure", label: "Course Brochure", Icon: IconFileText },
      { href: "/schedule-templates", label: "Course Schedule Template", Icon: IconCalendar },
    ],
  },
  {
    id: "faculties",
    label: "Faculties",
    Icon: IconGraduationCap,
    items: [{ href: "/faculties", label: "Faculties", Icon: IconGraduationCap }],
  },
  {
    id: "admin",
    label: "Admin Settings",
    Icon: IconSettings,
    items: [
      { href: "/settings/users", label: "User Accounts", Icon: IconSettings },
      { href: "/email-templates", label: "Email Templates", Icon: IconMail },
      { href: "/meet-links", label: "Demo Links", Icon: IconLink },
      { href: "/time-zones", label: "Time Zone Management", Icon: IconGlobe },
      { href: "/settings/lead-sources", label: "Lead Sources", Icon: IconSettings },
      { href: "/bank-details", label: "Bank Details", Icon: IconLandmark },
    ],
  },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) =>
    item.href === "/"
      ? pathname === "/" || pathname.startsWith("/students")
      : pathname.startsWith(item.href)
  );
}

function isItemActive(item: NavItem, pathname: string): boolean {
  return item.href === "/"
    ? pathname === "/" || pathname.startsWith("/students")
    : pathname.startsWith(item.href);
}

export function Sidebar() {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Auto-expand groups that contain active items
    const active = new Set<string>();
    NAV_GROUPS.forEach((group) => {
      if (isGroupActive(group, pathname)) {
        active.add(group.id);
      }
    });
    return active;
  });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "group/sidebar fixed left-0 top-0 z-40 flex h-full flex-col border-r border-slate-200/90 bg-white/95 shadow-[2px_0_12px_-4px_rgba(15,23,42,0.06)] backdrop-blur-sm transition-[width] duration-200 ease-out",
        "w-[var(--sidebar-collapsed)] hover:w-[var(--sidebar-expanded)] max-md:w-[var(--sidebar-collapsed)] max-md:hover:w-[var(--sidebar-collapsed)]",
      )}
      style={{ transitionProperty: "width" }}
    >
      <nav
        className="flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-1.5 py-3"
        aria-label="Main"
      >
        {NAV_GROUPS.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          const groupActive = isGroupActive(group, pathname);
          const GroupIcon = group.Icon;

          // For single-item groups, render as direct link
          if (group.items.length === 1) {
            const item = group.items[0];
            const active = isItemActive(item, pathname);
            return (
              <Link
                key={group.id}
                href={item.href}
                title={group.label}
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
                  <GroupIcon title={group.label} />
                </span>
                <span className="hidden min-w-0 truncate whitespace-nowrap group-hover/sidebar:inline max-md:hidden">
                  {group.label}
                </span>
              </Link>
            );
          }

          // For multi-item groups, render collapsible section
          return (
            <div key={group.id} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "relative flex min-h-[44px] items-center gap-2 rounded-none px-2.5 text-[13px] font-medium transition-colors duration-150",
                  groupActive
                    ? "bg-sky-50/50 text-primary"
                    : "text-slate-700 hover:bg-slate-50 max-md:text-slate-500",
                )}
                title={group.label}
              >
                <span
                  className={cn(
                    "flex w-9 shrink-0 justify-center",
                    groupActive
                      ? "text-primary"
                      : "text-slate-400 group-hover/sidebar:text-slate-600",
                  )}
                >
                  <GroupIcon title={group.label} />
                </span>
                <span className="hidden min-w-0 flex-1 truncate whitespace-nowrap text-left group-hover/sidebar:inline max-md:hidden">
                  {group.label}
                </span>
                <span className="hidden text-slate-400 group-hover/sidebar:inline max-md:hidden ml-auto">
                  {isExpanded ? (
                    <IconChevronDown className="h-4 w-4" />
                  ) : (
                    <IconChevronRight className="h-4 w-4" />
                  )}
                </span>
              </button>

              {/* Expanded items */}
              <div
                className={cn(
                  "flex-col border-l-2 border-slate-100 ml-5",
                  isExpanded ? "flex" : "hidden",
                )}
              >
                {group.items.map((item) => {
                  const active = isItemActive(item, pathname);
                  const ItemIcon = item.Icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className={cn(
                        "relative flex min-h-[36px] items-center gap-2 rounded-none px-2.5 text-[12px] font-medium transition-colors duration-150",
                        active
                          ? "bg-sky-50 text-primary"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span
                        className={cn(
                          "flex w-7 shrink-0 justify-center",
                          active ? "text-primary" : "text-slate-400",
                        )}
                      >
                        <ItemIcon title={item.label} />
                      </span>
                      <span className="hidden min-w-0 truncate whitespace-nowrap group-hover/sidebar:inline max-md:hidden text-left">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

