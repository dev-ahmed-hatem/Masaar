"use client";

import Link from "next/link";
import { Button } from "antd";

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
  const isTeacher = user?.role === "TEACHER";
  const isStaff = user?.role === "MODERATOR" || user?.role === "SUPERADMIN";

  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-4 dark:border-white/10">
      <Link href={`/${locale}`} className="text-lg font-semibold">
        {brand}
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href={`/${locale}`}>{home}</Link>
        {isTeacher && <Link href={`/${locale}/teacher`}>{teacher}</Link>}
        {isStaff && <Link href={`/${locale}/admin`}>{admin}</Link>}
        <Link
          href={otherHref}
          className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
        >
          {otherLabel}
        </Link>
        {user ? (
          <span className="flex items-center gap-2">
            <span className="opacity-70">{user.full_name || user.phone}</span>
            <Button size="small" onClick={logout}>
              {signOut}
            </Button>
          </span>
        ) : (
          <Link href={`/${locale}/sign-in`}>
            <Button type="primary" size="small">
              {signIn}
            </Button>
          </Link>
        )}
      </nav>
    </header>
  );
}
