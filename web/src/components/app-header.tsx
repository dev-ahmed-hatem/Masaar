"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Button } from "antd";
import { GraduationCap } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import NotificationsBell, { type BellLabels } from "@/components/notifications-bell";
import ThemeToggle from "@/components/theme-toggle";

export default function AppHeader({
  locale,
  brand,
  home,
  teacher,
  admin,
  browse,
  otherHref,
  otherLabel,
  signIn,
  signOut,
  bell,
}: {
  locale: string;
  brand: string;
  home: string;
  teacher: string;
  admin: string;
  browse: string;
  otherHref: string;
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

  const links: { href: string; label: string }[] = [{ href: `/${locale}`, label: home }];
  if (isTeacher) links.push({ href: `/${locale}/teacher`, label: teacher });
  if (isStaff) links.push({ href: `/${locale}/admin`, label: admin });
  // Anonymous visitors get a public "Find teachers" link; signed-in students
  // navigate via the dashboard sidebar instead.
  if (!isTeacher && !isStaff && !isStudent)
    links.push({ href: `/${locale}/teachers`, label: browse });

  const isActive = (href: string) =>
    href === `/${locale}` ? pathname === href : pathname.startsWith(href);

  const initial = (user?.full_name || user?.phone || "?").trim().charAt(0).toUpperCase();

  return (
    <header
      className="glass sticky top-0 z-20"
      style={{ borderInline: "none", borderTop: "none" }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
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
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors"
                  style={{
                    color: active ? "var(--brand-dark)" : "var(--ink-muted)",
                    background: active ? "var(--brand-tint)" : "transparent",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href={otherHref}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ color: "var(--ink-muted)", border: "1px solid var(--border-strong)" }}
          >
            {otherLabel}
          </Link>
          {user ? <NotificationsBell labels={bell} locale={locale} /> : null}
          {user ? (
            <div className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center rounded-full p-[2px]"
                style={{ background: "var(--grad-brand)" }}
              >
                <Avatar
                  size={30}
                  style={{
                    background: "#fff",
                    color: "var(--brand)",
                    fontWeight: 700,
                    border: "2px solid #fff",
                  }}
                >
                  {initial}
                </Avatar>
              </span>
              <span className="hidden text-sm font-semibold sm:inline" style={{ color: "var(--ink)" }}>
                {user.full_name || user.phone}
              </span>
              <Button size="small" onClick={logout}>
                {signOut}
              </Button>
            </div>
          ) : (
            <Link href={`/${locale}/sign-in`}>
              <Button type="primary">{signIn}</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
