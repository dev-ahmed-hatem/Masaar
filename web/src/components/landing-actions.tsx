"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/context/auth-context";

/**
 * Landing hero call-to-action. Auth lives in localStorage (client-only), so
 * this renders on the client: signed-out visitors get Sign up / Sign in;
 * a signed-in student gets a Browse-teachers shortcut; teachers/staff (who
 * have their own portals) see nothing here.
 */
export default function LandingActions({
  locale,
  signUp,
  signIn,
  browse,
}: {
  locale: string;
  signUp: string;
  signIn: string;
  browse: string;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (user) {
    if (user.role !== "STUDENT") return null;
    return (
      <div className="mt-9 flex flex-wrap gap-3">
        <Link href={`/${locale}/teachers`} className="btn btn-primary">
          {browse}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-9 flex flex-wrap gap-3">
      <Link href={`/${locale}/sign-up`} className="btn btn-primary">
        {signUp}
        <ArrowRight size={18} className="rtl:-scale-x-100" />
      </Link>
      <Link href={`/${locale}/sign-in`} className="btn btn-ghost">
        {signIn}
      </Link>
    </div>
  );
}
