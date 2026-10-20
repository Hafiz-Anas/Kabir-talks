"use client";

import { FileText, FolderTree, LayoutDashboard, type LucideIcon, Megaphone, MessageSquare, BarChart3, Mail, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ComingSoon } from "@/components/coming-soon";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string; icon: LucideIcon; exact?: boolean };

const ACTIVE: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Articles", href: "/admin/articles", icon: FileText },
  { label: "Categories", href: "/admin/categories", icon: FolderTree },
];

// Later phases: shown greyed out so the admin knows what's coming.
const UPCOMING: NavItem[] = [
  { label: "Comments", icon: MessageSquare },
  { label: "Subscribers", icon: Mail },
  { label: "Ads", icon: Megaphone },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6 text-sm">
      <ul className="space-y-1">
        {ACTIVE.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href!);
          return (
            <li key={item.label}>
              <Link
                href={item.href!}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 transition-colors",
                  active
                    ? "bg-obsidian-raised text-gold"
                    : "text-grey hover:bg-obsidian-raised/60 hover:text-ivory",
                )}
              >
                <item.icon aria-hidden className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="space-y-1">
        <p className="px-3 text-xs tracking-wide text-grey-dim uppercase">Later phases</p>
        <ul className="space-y-1">
          {UPCOMING.map((item) => (
            <li
              key={item.label}
              className="flex cursor-not-allowed items-center gap-3 px-3 py-2 text-grey-dim"
            >
              <item.icon aria-hidden className="size-4" />
              <span className="flex-1">{item.label}</span>
              <ComingSoon className="px-1.5 text-[0.625rem]" />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
