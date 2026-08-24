"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "antd";
import {
  CalendarClock,
  CalendarDays,
  Home,
  MessageCircle,
  Search,
  UserRound,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { chatApi } from "@/lib/chat";

type NavDict = Dictionary["nav"];

interface Tab {
  seg: string;
  icon: LucideIcon;
  label: string;
  badge?: boolean;
}

/**
 * Native-app style bottom tab bar (mobile only). Role-aware; shown for signed-in
 * students and teachers. Desktop uses the top nav in AppHeader instead.
 */
export default function MobileTabBar({ locale, nav }: { locale: Locale; nav: NavDict }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  const role = user?.role;
  const showFor = role === "STUDENT" || role === "TEACHER";

  useEffect(() => {
    if (!showFor) return;
    chatApi.unreadCount().then((r) => setUnread(r.unread_count)).catch(() => {});
  }, [showFor]);

  if (!showFor) return null;

  const tabs: Tab[] =
    role === "TEACHER"
      ? [
          { seg: "teacher", icon: Home, label: nav.home },
          { seg: "teacher/lessons", icon: CalendarDays, label: nav.lessonsShort },
          { seg: "teacher/calendar", icon: CalendarClock, label: nav.calendar },
          { seg: "teacher/messages", icon: MessageCircle, label: nav.messages, badge: true },
          { seg: "teacher/profile", icon: UserRound, label: nav.profile },
        ]
      : [
          { seg: "dashboard", icon: Home, label: nav.home },
          { seg: "teachers", icon: Search, label: nav.find },
          { seg: "lessons", icon: CalendarDays, label: nav.lessonsShort },
          { seg: "messages", icon: MessageCircle, label: nav.messages, badge: true },
          { seg: "wallet", icon: Wallet, label: nav.wallet },
        ];

  const hrefs = tabs.map((t) => `/${locale}/${t.seg}`);
  // Longest-prefix match so /teacher/lessons wins over /teacher.
  let activeHref = "";
  for (const href of hrefs) {
    if ((pathname === href || pathname.startsWith(`${href}/`)) && href.length > activeHref.length) {
      activeHref = href;
    }
  }

  return (
    <nav
      className="glass fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t lg:hidden"
      style={{
        borderColor: "var(--border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Primary"
    >
      {tabs.map((t, i) => {
        const href = hrefs[i];
        const active = href === activeHref;
        const Icon = t.icon;
        return (
          <Link
            key={t.seg}
            href={href}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold"
            style={{ color: active ? "var(--brand)" : "var(--ink-faint)" }}
          >
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.4 : 2} />
              {t.badge && unread > 0 && (
                <span className="absolute -end-2 -top-1">
                  <Badge count={unread} size="small" />
                </span>
              )}
            </span>
            <span className="max-w-full truncate">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
