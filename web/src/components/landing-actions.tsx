"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { useAuth } from "@/context/auth-context";

/**
 * Landing hero call-to-action. Auth lives in localStorage (client-only), so
 * this renders on the client: signed-out visitors get Sign up / Sign in;
 * signed-in users see nothing here (they navigate via the header — and a
 * student browse/book destination is not built yet).
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
  if (loading || user) return null;

  return (
    <div className="mt-9 flex flex-wrap justify-center gap-3">
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
