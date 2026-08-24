"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Button, Popover } from "antd";
import { GraduationCap, MoreVertical, UserRound } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Dictionary } from "@/i18n/dictionaries";
import NotificationsBell, { type BellLabels } from "@/components/notifications-bell";
import ThemeToggle from "@/components/theme-toggle";

type NavDict = Dictionary["nav"];

export default function AppHeader({
  locale,
  brand,
  nav,
  otherLabel,
  signIn,
  signOut,
  bell,
}: {
  locale: string;
  brand: string;
  nav: NavDict;
  otherLabel: string;
  signIn: string;
  signOut: string;
  bell: BellLabels;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isTeacher = user?.role === "TEACHER";
  const isStaff = user?.role === "MODERATOR" || user?.role === "SUPERADMIN";
  const isStudent = user?.role === "STUDENT";

  // Role-based primary nav (desktop). Mobile uses the bottom tab bar.
  const p = (seg: string) => `/${locale}${seg ? `/${seg}` : ""}`;
  let links: { href: string; label: string }[];
  if (isStudent) {
    links = [
      { href: p("dashboard"), label: nav.home },
      { href: p("teachers"), label: nav.browse },
      { href: p("lessons"), label: nav.lessons },
      { href: p("messages"), label: nav.messages },
      { href: p("wallet"), label: nav.wallet },
    ];
  } else if (isTeacher) {
    links = [
      { href: p("teacher"), label: nav.home },
      { href: p("teacher/lessons"), label: nav.lessons },
      { href: p("teacher/calendar"), label: nav.calendar },
      { href: p("teacher/messages"), label: nav.messages },
      { href: p("teacher/earnings"), label: nav.earnings },
    ];
  } else if (isStaff) {
    links = [
      { href: p(""), label: nav.home },
      { href: p("admin"), label: nav.admin },
    ];
  } else {
    links = [
      { href: p(""), label: nav.home },
      { href: p("teachers"), label: nav.browse },
    ];
  }

  // Longest-prefix match so /teacher/lessons wins over /teacher.
  const activeHref = links
    .map((l) => l.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const initial = (user?.full_name || user?.phone || "?").trim().charAt(0).toUpperCase();

  // Switch language but stay on the current route (swap only the locale prefix).
  const other = locale === "ar" ? "en" : "ar";
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const otherPath = `/${other}${rest}`;

  // Where "My profile" points, per role.
  const profileHref = isTeacher ? p("teacher/profile") : isStudent ? p("profile") : null;

  return (
    <header
      className="glass sticky top-0 z-20"
      style={{ borderInline: "none", borderTop: "none" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-7">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2.5 text-lg font-bold"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white"
              style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
            >
              <GraduationCap size={18} strokeWidth={2.4} />
            </span>
            {brand}
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-pill px-3.5 py-1.5 text-sm font-semibold${active ? " is-active" : ""}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? <NotificationsBell labels={bell} locale={locale} /> : null}

          {/* Secondary controls (theme, language, sign out) live in a menu so the
              bar stays uncluttered on mobile. */}
          <Popover
            trigger="click"
            placement="bottomRight"
            arrow={false}
            content={
              <div className="flex w-52 flex-col gap-3 p-1">
                {user && (
                  <div className="min-w-0 px-1">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>
                      {user.full_name || user.phone}
                    </div>
                    {user.full_name && (
                      <div className="truncate text-xs" style={{ color: "var(--ink-faint)" }}>{user.phone}</div>
                    )}
                  </div>
                )}
                {profileHref && (
                  <Link
                    href={profileHref}
                    className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-2)]"
                    style={{ color: "var(--ink)" }}
                  >
                    <UserRound size={16} />
                    {nav.profile}
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link
                    href={otherPath}
                    className="icon-btn flex-1 px-3 py-1.5 text-center text-sm font-semibold"
                  >
                    {otherLabel}
                  </Link>
                </div>
                {user && (
                  <Button block size="small" onClick={logout}>
                    {signOut}
                  </Button>
                )}
              </div>
            }
          >
            {user ? (
              <button
                type="button"
                aria-label={user.full_name || user.phone || "Account"}
                className="inline-flex items-center justify-center rounded-full p-[2px]"
                style={{ background: "var(--grad-brand)" }}
              >
                <Avatar
                  size={32}
                  style={{ background: "#fff", color: "var(--brand)", fontWeight: 700, border: "2px solid #fff" }}
                >
                  {initial}
                </Avatar>
              </button>
            ) : (
              <button type="button" aria-label="Menu" className="icon-btn h-9 w-9">
                <MoreVertical size={18} strokeWidth={2.2} />
              </button>
            )}
          </Popover>

          {!user && (
            <Link href={`/${locale}/sign-in`}>
              <Button type="primary">{signIn}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
