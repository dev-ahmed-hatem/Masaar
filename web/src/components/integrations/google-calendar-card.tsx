"use client";

import { useEffect, useState } from "react";
import { App, Button, Spin, Tag, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { integrations, type GoogleStatus } from "@/lib/integrations";

type Dict = Dictionary["googleCalendar"];

const { Paragraph } = Typography;

export default function GoogleCalendarCard({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
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
      message.error(disabled ? dict.unavailable : dict.error);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await integrations.googleDisconnect());
      message.success(dict.disconnected);
    } catch {
      message.error(dict.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="surface p-5 sm:p-6">
      <h2
        className="mb-2 text-lg font-bold"
        style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
      >
        {dict.title}
      </h2>
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        {dict.description}
      </Paragraph>

      {loading ? (
        <Spin />
      ) : status?.connected ? (
        <div className="flex flex-col gap-3">
          <div>
            {status.sync_enabled ? (
              <Tag color="green">
                {dict.connectedAs.replace("{email}", status.google_email)}
              </Tag>
            ) : (
              <Tag color="orange">{dict.reconnectNeeded}</Tag>
            )}
          </div>
          <div className="flex gap-2">
            {!status.sync_enabled && (
              <Button type="primary" loading={busy} onClick={connect}>
                {dict.connect}
              </Button>
            )}
            <Button danger loading={busy} onClick={disconnect}>
              {dict.disconnect}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="primary" icon={<CalendarOutlined />} loading={busy} onClick={connect}>
          {dict.connect}
        </Button>
      )}
    </div>
  );
}
