"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/context/auth-context";

/**
 * Landing hero call-to-action. Auth lives in localStorage (client-only), so
 * this renders on the client: signed-out visitors get Create account / Sign in;
 * teachers, staff and signed-in students see nothing, because the hero search
 * above already gives them the one action they need.
 *
 * Note there is deliberately no "Find teachers" button here — the hero search
 * is that button, and having both put the same call to action on screen twice.
 */
export default function LandingActions({
  locale,
  signUp,
  signIn,
}: {
  locale: string;
  signUp: string;
  signIn: string;
}) {
  const { user, loading } = useAuth();
  if (loading) return null;

  if (user) return null;

  return (
    <div className="mt-6 flex flex-wrap gap-3">
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
