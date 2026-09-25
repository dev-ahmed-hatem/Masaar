"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, CalendarPlus } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { integrations, type GoogleStatus } from "@/lib/integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["googleCalendar"];

export default function GoogleCalendarCard({ dict, locale }: { dict: Dict; locale: Locale }) {
  const toast = useToast();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    integrations
      .googleStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, google_email: "", sync_enabled: false }))
      .finally(() => setLoading(false));
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const { auth_url } = await integrations.googleConnectUrl(locale);
      window.location.href = auth_url;
    } catch (err) {
      const disabled = err instanceof ApiError && err.code === "integration_disabled";
      toast.error(disabled ? dict.unavailable : dict.error);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await integrations.googleDisconnect());
      toast.success(dict.disconnected);
    } catch {
      toast.error(dict.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{dict.title}</CardTitle>
        <CardDescription>{dict.description}</CardDescription>
      </CardHeader>

      <div className="p-5 pt-0">
        {loading ? (
          <Skeleton className="h-11 w-48" />
        ) : status?.connected ? (
          <div className="flex flex-col items-start gap-3">
            {status.sync_enabled ? (
              <Badge variant="success">
                <CalendarCheck aria-hidden />
                <bdi>
                  {status.google_email
                    ? dict.connectedAs.replace("{email}", status.google_email)
                    : dict.connected}
                </bdi>
              </Badge>
            ) : (
              /* The token was revoked or expired: the calendar is linked but no
                 longer syncing, so the fix is to reconnect, not to disconnect. */
              <Badge variant="warning">{dict.reconnectNeeded}</Badge>
            )}
            <div className="flex flex-wrap gap-2">
              {!status.sync_enabled ? (
                <Button loading={busy} onClick={connect}>
                  {dict.connect}
                </Button>
              ) : null}
              <Button variant="outline" loading={busy} onClick={disconnect}>
                {dict.disconnect}
              </Button>
            </div>
          </div>
        ) : (
          <Button loading={busy} onClick={connect}>
            <CalendarPlus aria-hidden />
            {dict.connect}
          </Button>
        )}
      </div>
    </Card>
  );
}
