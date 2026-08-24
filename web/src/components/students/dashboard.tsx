"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Avatar, Spin } from "antd";
import { ArrowRight, CalendarClock, MessageCircle, Search, Star } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { listFavorites } from "@/lib/favorites";
import { listTeachers, type TeacherListItem } from "@/lib/teachers";
import { formatWhen, subjectLabel } from "@/components/bookings/shared";
import { SectionTitle } from "@/components/ui";

type Dict = Dictionary["dashboard"];

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
      chatApi.unreadCount().catch(() => ({ unread_count: 0 })),
      listFavorites().catch(() => []),
    ])
      .then(async ([bk, uc, favs]) => {
        if (!active) return;
        setNow(Date.now());
        setBookings(bk.results);
        setUnread(uc.unread_count);
        setFavorites(favs);
        const market = user?.market;
        if (market) {
          const rec = await listTeachers({ market, ordering: "-rating_avg", page_size: 8 }).catch(() => null);
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

  const next = bookings
    .filter((b) => b.status === "CONFIRMED" && new Date(b.scheduled_start).getTime() > now)
    .sort((a, b) => +new Date(a.scheduled_start) - +new Date(b.scheduled_start))[0];
  const firstName = (user?.full_name || "").split(" ")[0] || "";

  return (
    <section className="flex flex-col gap-8">
      {/* Greeting + search-first entry */}
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {fill(dict.title, { name: firstName })}
        </h1>
        <Link
          href={`/${locale}/teachers`}
          className="surface surface-hover flex items-center gap-3 rounded-full px-5 py-3.5"
          style={{ boxShadow: "var(--shadow-md)" }}
        >
          <Search size={20} style={{ color: "var(--brand)" }} />
          <span className="text-sm sm:text-base" style={{ color: "var(--ink-muted)" }}>
            {dict.searchPrompt}
          </span>
        </Link>
      </div>

      {/* Next lesson */}
      <div className="surface p-5 sm:p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>
          {dict.nextLesson}
        </h2>
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                <CalendarClock size={22} />
              </span>
              <div className="min-w-0">
                <div className="text-lg font-semibold" style={{ color: "var(--ink)" }}>{subjectLabel(next, locale)}</div>
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

      {/* Your teachers */}
      {favorites.length > 0 && (
        <TeacherRail
          title={dict.yourTeachers}
          action={<Link href={`/${locale}/favorites`}>{dict.viewAll}</Link>}
          teachers={favorites}
          locale={locale}
        />
      )}

      {/* Recommended */}
      {recommended.length > 0 && (
        <TeacherRail
          title={dict.recommended}
          action={<Link href={`/${locale}/teachers`}>{dict.viewAll}</Link>}
          teachers={recommended}
          locale={locale}
        />
      )}

      {/* Messages */}
      <Link
        href={`/${locale}/messages`}
        className="surface surface-hover flex items-center gap-3 p-4 sm:p-5"
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
          <MessageCircle size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{dict.messagesTitle}</span>
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {unread > 0 ? fill(dict.unreadMessages, { n: String(unread) }) : dict.allRead}
          </span>
        </div>
        <ArrowRight size={18} className="rtl:-scale-x-100" style={{ color: "var(--ink-faint)" }} />
      </Link>
    </section>
  );
}

function TeacherRail({
  title,
  action,
  teachers,
  locale,
}: {
  title: string;
  action?: React.ReactNode;
  teachers: TeacherListItem[];
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle action={action}>{title}</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {teachers.map((t) => (
          <Link
            key={t.id}
            href={`/${locale}/teachers/${t.id}`}
            className="surface surface-hover flex w-40 shrink-0 flex-col items-center gap-2 p-4 text-center sm:w-44"
          >
            <Avatar size={64} src={t.photo_url ?? undefined} style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700, fontSize: 24 }}>
              {(t.full_name || "?").trim().charAt(0).toUpperCase()}
            </Avatar>
            <div className="w-full truncate text-sm font-semibold" style={{ color: "var(--ink)" }}>{t.full_name}</div>
            <div className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
              <Star size={13} fill="var(--warning)" stroke="var(--warning)" />
              {Number(t.rating_avg) > 0 ? Number(t.rating_avg).toFixed(1) : "—"}
              {t.rating_count > 0 && <span style={{ color: "var(--ink-faint)" }}>({t.rating_count})</span>}
            </div>
            {t.from_price && (
              <div className="text-xs font-semibold" style={{ color: "var(--ink)" }}>{t.from_price.display}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
