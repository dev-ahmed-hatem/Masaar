"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { notificationsApi, type NotificationItem } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

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
      setItems(
        (prev) =>
          prev?.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })) ?? prev,
      );
    } catch {
      /* ignore */
    }
  }

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={labels.title}
          className="relative inline-flex size-9 items-center justify-center rounded-control border border-border-strong text-ink-muted transition-colors hover:border-brand hover:bg-brand-tint hover:text-on-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Bell className="size-[17px]" aria-hidden />
          {count > 0 ? (
            /* The count pairs --brand with --on-brand: white on the dark
               theme's mint brand is 2.44:1. */
            <span className="absolute -end-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-pill bg-brand px-1 text-[0.625rem] font-bold leading-none text-on-brand tabular-nums">
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <span className="t-small font-semibold text-ink">{labels.title}</span>
          <Button variant="ghost" size="sm" onClick={markAll} disabled={count === 0}>
            {labels.markAllRead}
          </Button>
        </div>

        {items == null ? (
          <div className="flex flex-col gap-2 p-3" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-control" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<BellOff aria-hidden />} title={labels.empty} className="py-8" />
        ) : (
          <div className="flex max-h-[min(24rem,60vh)] flex-col gap-1 overflow-y-auto p-2">
            {items.map((n) => (
              <div
                key={n.id}
                className={
                  n.read_at
                    ? "rounded-control px-3 py-2.5"
                    : "rounded-control bg-brand-tint px-3 py-2.5"
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    dir="auto"
                    className="flex min-w-0 items-center gap-2 t-small font-semibold text-ink"
                  >
                    {!n.read_at && (
                      <span aria-hidden className="inline-block size-2 shrink-0 rounded-full bg-brand" />
                    )}
                    {n.title}
                  </span>
                  <span className="shrink-0 t-caption text-ink-muted">
                    {new Date(n.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {n.body ? (
                  <p dir="auto" className="mt-0.5 t-caption text-ink-muted">
                    {n.body}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
