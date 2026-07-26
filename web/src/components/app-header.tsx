"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, Button } from "antd";

import { useAuth } from "@/context/auth-context";

export default function AppHeader({
  locale,
  brand,
  home,
  teacher,
  admin,
  otherHref,
  otherLabel,
  signIn,
  signOut,
}: {
  locale: string;
  brand: string;
  home: string;
  teacher: string;
  admin: string;
  otherHref: string;
  otherLabel: string;
  signIn: string;
  signOut: string;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isTeacher = user?.role === "TEACHER";
  const isStaff = user?.role === "MODERATOR" || user?.role === "SUPERADMIN";

  const links: { href: string; label: string }[] = [{ href: `/${locale}`, label: home }];
  if (isTeacher) links.push({ href: `/${locale}/teacher`, label: teacher });
  if (isStaff) links.push({ href: `/${locale}/admin`, label: admin });

  const isActive = (href: string) =>
    href === `/${locale}` ? pathname === href : pathname.startsWith(href);

  const initial = (user?.full_name || user?.phone || "?").trim().charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-20 backdrop-blur"
      style={{
        background: "color-mix(in srgb, var(--surface) 88%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-7">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-lg font-semibold"
            style={{ color: "var(--ink)" }}
          >
            <span
              className="inline-block h-6 w-6 rounded-lg"
              style={{
                background:
                  "linear-gradient(135deg, var(--brand) 0%, #12a894 100%)",
              }}
            />
            {brand}
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    color: active ? "var(--brand)" : "var(--ink-muted)",
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
          <Link
            href={otherHref}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors"
            style={{ color: "var(--ink-muted)", border: "1px solid var(--border)" }}
          >
            {otherLabel}
          </Link>
          {user ? (
            <div className="flex items-center gap-2.5">
              <Avatar
                size={32}
                style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}
              >
                {initial}
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline" style={{ color: "var(--ink)" }}>
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
