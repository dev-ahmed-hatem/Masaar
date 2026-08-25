"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Result, Spin } from "antd";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { integrations } from "@/lib/integrations";

type Dict = Dictionary["googleCalendar"];

export default function GoogleCallback({ dict, locale }: { dict: Dict; locale: Locale }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useAuth();
  const [failed, setFailed] = useState(false);
  const ran = useRef(false);

  const code = params.get("code");
  const state = params.get("state");
  const dest =
    user?.role === "TEACHER" ? `/${locale}/teacher/profile` : `/${locale}/profile`;

  useEffect(() => {
    if (ran.current || !code || !state) return;
    ran.current = true;
    integrations
      .googleComplete(code, state)
      .then(() => router.replace(dest))
      .catch(() => setFailed(true));
  }, [code, state, router, dest]);

  // Missing params (user landed here without a valid redirect) is an error too.
  if (failed || !code || !state) {
    return (
      <Result
        status="error"
        title={dict.callbackError}
        extra={
          <Button type="primary" onClick={() => router.replace(dest)}>
            {dict.backToProfile}
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-20">
      <Spin size="large" />
      <p style={{ color: "var(--ink-faint)" }}>{dict.callbackTitle}</p>
    </div>
  );
}
