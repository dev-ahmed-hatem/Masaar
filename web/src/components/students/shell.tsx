"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "antd";
import {
  CalendarDays,
  Heart,
  LayoutDashboard,
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
export type StudentSection =
  | "overview"
  | "teachers"
  | "lessons"
  | "messages"
  | "wallet"
  | "favorites"
  | "profile";

const ITEMS: { key: StudentSection; seg: string; icon: LucideIcon; label: keyof NavDict }[] = [
  { key: "overview", seg: "dashboard", icon: LayoutDashboard, label: "overview" },
  { key: "teachers", seg: "teachers", icon: Search, label: "browse" },
  { key: "lessons", seg: "lessons", icon: CalendarDays, label: "lessons" },
  { key: "messages", seg: "messages", icon: MessageCircle, label: "messages" },
  { key: "wallet", seg: "wallet", icon: Wallet, label: "wallet" },
  { key: "favorites", seg: "favorites", icon: Heart, label: "favorites" },
  { key: "profile", seg: "profile", icon: UserRound, label: "profile" },
];

/**
 * App-shell for the student area: a left sidebar (desktop) / scrollable chip row
 * (mobile). Renders the shell only for signed-in students; anonymous or other
 * roles (e.g. on the public /teachers pages) get the content unchanged.
 */
export default function StudentShell({
  active,
  nav,
  locale,
  children,
}: {
  active: StudentSection;
  nav: NavDict;
  locale: Locale;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    chatApi.unreadCount().then((r) => setUnread(r.unread_count)).catch(() => {});
  }, [user?.role]);

  if (user?.role !== "STUDENT") return <>{children}</>;

  const link = (it: (typeof ITEMS)[number], mobile: boolean) => {
    const isActive = it.key === active;
    const Icon = it.icon;
    const label = nav[it.label];
    const badge = it.key === "messages" && unread > 0;
    return (
      <Link
        key={it.key}
        href={`/${locale}/${it.seg}`}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          mobile ? "shrink-0" : ""
        }`}
        style={{
          color: isActive ? "var(--brand-dark)" : "var(--ink-muted)",
          background: isActive ? "var(--brand-tint)" : "transparent",
        }}
      >
        <Icon size={17} strokeWidth={2.1} />
        <span>{label}</span>
        {badge && <Badge count={unread} size="small" />}
      </Link>
    );
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <nav className="surface sticky top-20 flex flex-col gap-1 p-2">
          {ITEMS.map((it) => link(it, false))}
        </nav>
      </aside>
      {/* Mobile chip row */}
      <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {ITEMS.map((it) => link(it, true))}
      </nav>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
