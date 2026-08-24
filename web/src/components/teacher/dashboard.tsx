"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Spin, Tag } from "antd";
import { ArrowRight, CalendarClock, Hourglass, Inbox, Star, Wallet } from "lucide-react";

import { formatWhen, StatusTag, subjectLabel } from "@/components/bookings/shared";
import { ListRow, SectionTitle, SummaryStrip } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking } from "@/lib/bookings";
import { teacherSelf, type TeacherDashboard } from "@/lib/teacher-self";

type Dict = Dictionary["teacherDashboard"];
type BookingsDict = Dictionary["bookings"];

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default function TeacherDashboardView({
  dict,
  bookingsDict,
  locale,
}: {
  dict: Dict;
  bookingsDict: BookingsDict;
  locale: string;
}) {
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [requests, setRequests] = useState<Booking[]>([]);
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      teacherSelf.dashboard(),
      listBookings(undefined, { group: "requested", page_size: 5 }).catch(() => ({ results: [] as Booking[] })),
      listBookings(undefined, { group: "upcoming", page_size: 6 }).catch(() => ({ results: [] as Booking[] })),
    ])
      .then(([d, req, up]) => {
        setData(d);
        setRequests(req.results);
        setUpcoming(up.results);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={error}
        action={<Button size="small" onClick={load}>{dict.retry}</Button>}
      />
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  const { profile, earnings, next_lesson } = data;
  const restUpcoming = upcoming.filter((b) => b.id !== next_lesson?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      {!profile.is_published && (
        <Alert
          type="warning"
          showIcon
          message={dict.unpublishedTitle}
          description={dict.unpublishedBody}
          action={
            <Link href={`/${locale}/teacher/profile`}>
              <Button size="small" type="primary">{dict.completeProfile}</Button>
            </Link>
          }
        />
      )}

      {/* Greeting */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {dict.welcome.replace("{name}", profile.full_name || "")}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5 text-sm" style={{ color: "var(--ink-muted)" }}>
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: "var(--ink)" }}>
            <Star size={14} fill="var(--warning)" stroke="var(--warning)" />
            {profile.rating_avg.toFixed(1)}
            <span className="font-normal" style={{ color: "var(--ink-faint)" }}>({profile.rating_count})</span>
          </span>
          <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>
          <span>{dict.lessonsTaught.replace("{n}", String(profile.lessons_count))}</span>
          <Tag color={profile.is_published ? "green" : "default"} bordered={false} style={{ borderRadius: 999, fontWeight: 600 }}>
            {profile.is_published ? dict.published : dict.draft}
          </Tag>
        </div>
      </div>

      {/* Earnings + upcoming summary */}
      <SummaryStrip
        items={[
          { label: dict.earningsPending, value: money(earnings.pending_minor, earnings.currency), icon: <Hourglass size={18} /> },
          { label: dict.earningsPaid, value: money(earnings.paid_minor, earnings.currency), icon: <Wallet size={18} /> },
          { label: dict.upcoming, value: data.upcoming_count, icon: <CalendarClock size={18} /> },
        ]}
      />

      {/* Lesson requests */}
      {requests.length > 0 && (
        <div className="flex flex-col gap-3">
          <SectionTitle action={<Link href={`/${locale}/teacher/lessons`}>{dict.viewAll}</Link>}>
            {dict.pendingRequests}
          </SectionTitle>
          <div className="flex flex-col gap-2">
            {requests.map((b) => (
              <Link key={b.id} href={`/${locale}/teacher/lessons`} className="block">
                <ListRow
                  className="surface-hover"
                  leading={
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                      <Inbox size={18} />
                    </span>
                  }
                  title={subjectLabel(b, locale)}
                  subtitle={`${b.student_name} · ${formatWhen(b.scheduled_start, locale)}`}
                  trailing={<StatusTag dict={bookingsDict} status={b.status} />}
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Next lesson + upcoming */}
      <div className="flex flex-col gap-3">
        <SectionTitle action={<Link href={`/${locale}/teacher/lessons`}>{dict.viewAll}</Link>}>
          {dict.upcoming}
        </SectionTitle>
        {next_lesson ? (
          <div className="surface flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--brand-tint)", color: "var(--brand)" }}>
                <CalendarClock size={22} />
              </span>
              <div className="min-w-0">
                <div className="text-base font-semibold" style={{ color: "var(--ink)" }}>{subjectLabel(next_lesson, locale)}</div>
                <div className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {next_lesson.student_name} · {formatWhen(next_lesson.scheduled_start, locale)} · {next_lesson.duration_min} {dict.minutes}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {next_lesson.meeting_link && (
                <a href={next_lesson.meeting_link} target="_blank" rel="noreferrer">
                  <Button type="primary">{dict.join}</Button>
                </a>
              )}
              <Link href={`/${locale}/teacher/lessons`}>
                <Button>{dict.allLessons}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="surface flex items-center justify-between gap-4 p-5 sm:p-6">
            <span style={{ color: "var(--ink-muted)" }}>{dict.noUpcoming}</span>
            <Link href={`/${locale}/teacher/calendar`} className="flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--brand)" }}>
              {dict.linkCalendar}
              <ArrowRight size={15} className="rtl:-scale-x-100" />
            </Link>
          </div>
        )}

        {restUpcoming.map((b) => (
          <Link key={b.id} href={`/${locale}/teacher/lessons`} className="block">
            <ListRow
              className="surface-hover"
              leading={
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "var(--surface-2)", color: "var(--ink-muted)" }}>
                  <CalendarClock size={18} />
                </span>
              }
              title={subjectLabel(b, locale)}
              subtitle={`${b.student_name} · ${formatWhen(b.scheduled_start, locale)}`}
              trailing={<StatusTag dict={bookingsDict} status={b.status} />}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
