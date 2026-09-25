"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GraduationCap, MoreVertical, UserRound } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { useAuth } from "@/context/auth-context";
import type { Dictionary } from "@/i18n/dictionaries";
import NotificationsBell, { type BellLabels } from "@/components/notifications-bell";
import ThemeToggle from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/cn";

type NavDict = Dictionary["nav"];

const MENU_ITEM =
  "flex items-center gap-2 rounded-control px-2.5 py-2 t-small font-semibold text-ink transition-colors hover:bg-surface-2";

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
  const [menuOpen, setMenuOpen] = useState(false);
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

  // Switch language but stay on the current route (swap only the locale prefix).
  const other = locale === "ar" ? "en" : "ar";
  const rest = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) : pathname;
  const otherPath = `/${other}${rest}`;

  // Where "My profile" points, per role.
  const profileHref = isTeacher ? p("teacher/profile") : isStudent ? p("profile") : null;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-7">
          <Link href={`/${locale}`} aria-label={brand} className="shrink-0">
            <Logo locale={locale} size="sm" />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={cn("nav-pill px-3.5 py-1.5 t-small font-semibold", isActive(href) && "is-active")}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? <NotificationsBell labels={bell} locale={locale} /> : null}

          {/* Secondary controls (theme, language, sign out) live in a menu so the
              bar stays uncluttered on mobile. */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              {user ? (
                <button
                  type="button"
                  aria-label={user.full_name || user.phone || "Account"}
                  className="inline-flex items-center justify-center rounded-full bg-brand-tint p-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {/* Teal on white is only 2.44:1 in dark mode, where --brand
                      lifts to #34B9A4. The filled pair is the audited one. */}
                  <Avatar
                    size="xs"
                    shape="circle"
                    name={user.full_name || user.phone}
                    className="bg-brand [&>span]:text-on-brand"
                  />
                </button>
              ) : (
                <button type="button" aria-label="Menu" className="icon-btn size-9">
                  <MoreVertical size={18} strokeWidth={2.2} />
                </button>
              )}
            </PopoverTrigger>

            <PopoverContent align="end" className="w-56 p-2">
              <div className="flex flex-col gap-1">
                {user && (
                  <div className="min-w-0 px-1.5 pb-1">
                    <div dir="auto" className="truncate t-small font-semibold text-ink">
                      {user.full_name || user.phone}
                    </div>
                    {user.full_name && (
                      <div dir="ltr" className="truncate t-caption text-ink-faint">
                        {user.phone}
                      </div>
                    )}
                  </div>
                )}

                {/* Primary nav for guests on mobile (desktop shows it in the top
                    bar; signed-in users navigate via the bottom tab bar). */}
                {!user && (
                  <div className="flex flex-col lg:hidden">
                    {links.map(({ href, label }) => (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={MENU_ITEM}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Secondary entry to the teacher application (not for teachers/staff). */}
                {!isTeacher && !isStaff && (
                  <Link
                    href={p("become-a-teacher")}
                    onClick={() => setMenuOpen(false)}
                    className={MENU_ITEM}
                  >
                    <GraduationCap className="size-4" aria-hidden />
                    {nav.apply}
                  </Link>
                )}
                {profileHref && (
                  <Link href={profileHref} onClick={() => setMenuOpen(false)} className={MENU_ITEM}>
                    <UserRound className="size-4" aria-hidden />
                    {nav.profile}
                  </Link>
                )}

                <Separator className="my-1" />

                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <Link
                    href={otherPath}
                    onClick={() => setMenuOpen(false)}
                    className="icon-btn flex-1 px-3 py-1.5 text-center t-small font-semibold"
                  >
                    {otherLabel}
                  </Link>
                </div>

                {user && (
                  <Button variant="outline" size="sm" className="mt-1 w-full" onClick={logout}>
                    {signOut}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {!user && (
            <Button asChild>
              <Link href={`/${locale}/sign-in`}>{signIn}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
