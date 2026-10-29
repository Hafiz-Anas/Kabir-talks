"use client";

import {
  FileStack,
  FileText,
  FolderTree,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  Mail,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Counts shown as badges next to nav items (set by the admin layout). */
export type NavBadges = { pendingComments?: number; unreadMessages?: number };

type NavItem = { label: string; href: string; icon: LucideIcon; exact?: boolean; badge?: keyof NavBadges; badgeLabel?: string };

const GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
      { label: "Articles", href: "/admin/articles", icon: FileText },
      { label: "Categories", href: "/admin/categories", icon: FolderTree },
      { label: "Comments", href: "/admin/comments", icon: MessageSquare, badge: "pendingComments", badgeLabel: "pending" },
      { label: "Breaking news", href: "/admin/breaking", icon: Zap },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Newsletter", href: "/admin/newsletter", icon: Mail },
      { label: "Ads", href: "/admin/ads", icon: Megaphone },
      { label: "Messages", href: "/admin/messages", icon: MessagesSquare, badge: "unreadMessages", badgeLabel: "unread" },
      { label: "Pages", href: "/admin/pages", icon: FileStack },
    ],
  },
  {
    label: "Site",
    items: [
      { label: "Email outbox", href: "/admin/emails", icon: Inbox },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminNav({ onNavigate, ...badges }: { onNavigate?: () => void } & NavBadges) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-6 text-sm">
      {GROUPS.map((group, index) => (
        <div key={group.label ?? index} className="space-y-1">
          {group.label && <p className="px-3 text-xs tracking-wide text-grey-dim uppercase">{group.label}</p>}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const count = item.badge ? (badges[item.badge] ?? 0) : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-sm px-3 py-2 transition-colors",
                      active ? "bg-obsidian-raised text-gold" : "text-grey hover:bg-obsidian-raised/60 hover:text-ivory",
                    )}
                  >
                    <item.icon aria-hidden className="size-4" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-gold px-1.5 text-xs font-medium text-black tabular-nums">
                        {count}
                        <span className="sr-only"> {item.badgeLabel}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
