"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, Popover, Spin } from "antd";
import { Bell } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { notificationsApi, type NotificationItem } from "@/lib/notifications";

const POLL_MS = 30000;

export interface BellLabels {
  title: string;
  markAllRead: string;
  empty: string;
}

export default function NotificationsBell({
  labels,
  locale,
}: {
  labels: BellLabels;
  locale: string;
}) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const refreshCount = useCallback(() => {
    notificationsApi
      .unreadCount()
      .then((res) => setCount(res.unread_count))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshCount();
    const timer = setInterval(() => {
      if (!document.hidden) refreshCount();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [user, refreshCount]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setItems(null);
      try {
        const res = await notificationsApi.list();
        setItems(res.results);
      } catch {
        setItems([]);
      }
    }
  }

  async function markAll() {
    try {
      await notificationsApi.markRead();
      setCount(0);
      setItems((prev) => prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? prev);
    } catch {
      /* ignore */
    }
  }

  if (!user) return null;

  const content = (
    <div style={{ width: 320 }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {labels.title}
        </span>
        <Button size="small" type="link" onClick={markAll} disabled={count === 0}>
          {labels.markAllRead}
        </Button>
      </div>
      {items == null ? (
        <div className="flex justify-center py-6">
          <Spin size="small" />
        </div>
      ) : items.length === 0 ? (
        <Empty description={labels.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {items.map((n) => (
            <div
              key={n.id}
              className="rounded-xl px-3 py-2.5"
              style={{ background: n.read_at ? "transparent" : "var(--brand-tint)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {!n.read_at && (
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: "var(--grad-brand)" }}
                    />
                  )}
                  {n.title}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {new Date(n.created_at).toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {n.body ? (
                <div className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {n.body}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={onOpenChange}
      placement="bottomRight"
    >
      <button
        type="button"
        aria-label={labels.title}
        className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[var(--brand-tint)]"
        style={{ color: "var(--ink-muted)", border: "1px solid var(--border-strong)" }}
      >
        <Badge count={count} size="small" offset={[2, -2]} color="var(--brand)">
          <Bell size={17} />
        </Badge>
      </button>
    </Popover>
  );
}
