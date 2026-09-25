"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarX, Loader2 } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { integrations } from "@/lib/integrations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";

type Dict = Dictionary["googleCalendar"];

export default function GoogleCallback({ dict, locale }: { dict: Dict; locale: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [failed, setFailed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const ran = useRef(false);

  const code = params.get("code");
  const state = params.get("state");
  const dest =
    user?.role === "TEACHER" ? `/${locale}/teacher/profile` : `/${locale}/profile`;

  useEffect(() => {
    if (ran.current || !code || !state) return;
    ran.current = true;
    // Auth codes are single-use. Guard by the code value so a reload / re-open
    // of this URL can't re-submit an already-redeemed code (→ invalid_grant).
    const key = `gcal-oauth:${code}`;
    if (sessionStorage.getItem(key)) {
      router.replace(dest);
      return;
    }
    sessionStorage.setItem(key, "1");
    integrations
      .googleComplete(code, state)
      .then(() => router.replace(dest))
      .catch((err) => {
        setReason(err instanceof ApiError ? err.message : null);
        setFailed(true);
      });
  }, [code, state, router, dest]);

  // Missing params (user landed here without a valid redirect) is an error too.
  if (failed || !code || !state) {
    return (
      <Card className="mx-auto max-w-lg">
        <EmptyState
          icon={<CalendarX aria-hidden />}
          title={dict.callbackError}
          description={reason ?? undefined}
          action={
            <Button onClick={() => router.replace(dest)}>{dict.backToProfile}</Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-20" role="status" aria-busy>
      <Loader2 className="size-7 animate-spin text-brand" aria-hidden />
      <p className="t-small text-ink-muted">{dict.callbackTitle}</p>
    </div>
  );
}
