"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Avatar, Rate, Spin } from "antd";
import { ArrowRight, CalendarClock } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { apiAuthed, ApiError } from "@/lib/api";
import { listBookings, type Booking } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { listFavorites } from "@/lib/favorites";
import { listTeachers, type TeacherListItem } from "@/lib/teachers";
import { getWallet, type Wallet } from "@/lib/wallet";
import { formatWhen, subjectLabel } from "@/components/bookings/shared";
import { PageHeader, StatCard } from "@/components/ui";

type Dict = Dictionary["dashboard"];

interface Notif {
  id: number;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

export default function StudentDashboard({
  dict,
  locale,
}: {
  dict: Dict;
  locale: Locale;
}) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [favorites, setFavorites] = useState<TeacherListItem[]>([]);
  const [recommended, setRecommended] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      listBookings(),
      getWallet(),
      apiAuthed<{ results: Notif[] } | Notif[]>("/api/notifications/").catch(() => ({ results: [] })),
      chatApi.unreadCount().catch(() => ({ unread_count: 0 })),
      listFavorites().catch(() => []),
    ])
      .then(async ([bk, w, nt, uc, favs]) => {
        if (!active) return;
        setNow(Date.now());
        setBookings(bk.results);
        setWallet(w.wallet);
        setNotifs((Array.isArray(nt) ? nt : nt.results).slice(0, 5));
        setUnread(uc.unread_count);
        setFavorites(favs);
        const market = user?.market;
        if (market) {
          const rec = await listTeachers({ market, ordering: "-rating_avg", page_size: 4 }).catch(() => null);
          if (active && rec) setRecommended(rec.results);
        }
      })
      .catch((err) => active && setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dict.loadError, user?.market]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    );
  }
  if (error) return <Alert type="error" showIcon message={error} />;

  const upcoming = bookings
    .filter((b) => b.status === "CONFIRMED" && new Date(b.scheduled_start).getTime() > now)
    .sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start));
  const next = upcoming[0];
  const completed = bookings.filter((b) => b.status === "COMPLETED");
  const hours = Math.round(completed.reduce((s, b) => s + b.duration_min, 0) / 60);

  return (
    <section className="flex flex-col gap-8">
      <PageHeader
        title={fill(dict.title, { name: (user?.full_name || "").split(" ")[0] || "" })}
        subtitle={dict.subtitle}
      />

      {/* Next lesson */}
      <div className="surface p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {dict.nextLesson}
        </h2>
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
              >
                <CalendarClock size={22} />
              </span>
              <div>
                <div className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                  {subjectLabel(next, locale)}
                </div>
                <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {fill(dict.withTeacher, { teacher: next.teacher_name })} · {formatWhen(next.scheduled_start, locale)}
                </div>
              </div>
            </div>
            {next.meeting_link && (
              <a href={next.meeting_link} target="_blank" rel="noreferrer" className="btn btn-primary">
                {dict.join}
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span style={{ color: "var(--ink-muted)" }}>{dict.noUpcoming}</span>
            <Link href={`/${locale}/teachers`} className="btn btn-primary">
              {dict.findCta}
              <ArrowRight size={16} className="rtl:-scale-x-100" />
            </Link>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={dict.statUpcoming} value={upcoming.length} />
        <StatCard label={dict.statCompleted} value={completed.length} />
        <StatCard label={dict.statHours} value={hours} />
        <StatCard label={dict.statBalance} value={wallet?.available_display ?? "—"} />
      </div>

      {/* Activity + Messages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface p-6">
          <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--ink)" }}>
            {dict.activityTitle}
          </h2>
          {notifs.length === 0 ? (
            <span className="text-sm" style={{ color: "var(--ink-muted)" }}>{dict.noActivity}</span>
          ) : (
            <ul className="flex flex-col gap-3">
              {notifs.map((n) => (
                <li key={n.id} className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{n.title}</span>
                  {n.body && <span className="text-sm" style={{ color: "var(--ink-muted)" }}>{n.body}</span>}
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    {new Date(n.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface flex flex-col p-6">
          <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--ink)" }}>
            {dict.messagesTitle}
          </h2>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {unread > 0 ? fill(dict.unreadMessages, { n: String(unread) }) : dict.allRead}
          </p>
          <Link href={`/${locale}/messages`} className="btn btn-ghost mt-auto self-start">
            {dict.openMessages}
          </Link>
        </div>
      </div>

      {/* Your teachers */}
      {favorites.length > 0 && (
        <TeacherRow title={dict.yourTeachers} teachers={favorites} locale={locale} />
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <TeacherRow title={dict.recommended} teachers={recommended} locale={locale} />
      )}
    </section>
  );
}

function TeacherRow({
  title,
  teachers,
  locale,
}: {
  title: string;
  teachers: TeacherListItem[];
  locale: Locale;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {teachers.map((t) => (
          <Link key={t.id} href={`/${locale}/teachers/${t.id}`} className="surface surface-hover flex items-center gap-3 p-4">
            <Avatar size={44} src={t.photo_url ?? undefined} style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700 }}>
              {(t.full_name || "?").trim().charAt(0).toUpperCase()}
            </Avatar>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{t.full_name}</div>
              <Rate disabled allowHalf value={Number(t.rating_avg)} style={{ fontSize: 11 }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
