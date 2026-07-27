"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spin } from "antd";

import { useAuth } from "@/context/auth-context";
import { homePathForRole, type Role } from "@/lib/auth";

/**
 * Client-side role guard. Auth state lives in localStorage (see lib/api tokens),
 * so guarding happens on the client: while the session resolves we show a
 * spinner; an anonymous visitor is sent to sign-in and a signed-in user without
 * an allowed role is bounced to their own home.
 */
export default function RouteGuard({
  locale,
  allow,
  children,
}: {
  locale: string;
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const allowed =
    user != null && allow.includes(user.role) && !user.must_change_password;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/${locale}/sign-in`);
    } else if (user.must_change_password) {
      // Provisioned accounts (e.g. approved teachers holding a temporary
      // password) must set their own password before using the portal.
      router.replace(`/${locale}/change-password`);
    } else if (!allow.includes(user.role)) {
      router.replace(homePathForRole(locale, user.role));
    }
  }, [loading, user, allow, locale, router]);

  if (!allowed) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  return <>{children}</>;
}
