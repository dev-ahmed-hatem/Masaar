"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Hourglass,
  Inbox,
  Wallet,
} from "lucide-react";

import { formatWhen, StatusTag, subjectLabel } from "@/components/bookings/shared";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking } from "@/lib/bookings";
import { teacherSelf, type TeacherDashboard } from "@/lib/teacher-self";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";

type Dict = Dictionary["teacherDashboard"];
type BookingsDict = Dictionary["bookings"];

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`.trim();
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
      listBookings(undefined, { group: "requested", page_size: 5 }).catch(() => ({
        results: [] as Booking[],
      })),
      listBookings(undefined, { group: "upcoming", page_size: 6 }).catch(() => ({
        results: [] as Booking[],
      })),
    ])
      .then(([d, req, up]) => {
        setData(d);
        setRequests(req.results);
        setUpcoming(up.results);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);
  // Reflect student-initiated reschedules/cancels on the open tab.
  useRefreshOnFocus(load);

  if (error) {
    return (
      <Alert
        variant="error"
        title={error}
        action={
          <Button variant="outline" size="sm" onClick={load}>
            {dict.retry}
          </Button>
        }
      />
    );
  }

  if (!data) return <DashboardSkeleton />;

  const { profile, earnings, next_lesson } = data;
  const restUpcoming = upcoming.filter((b) => b.id !== next_lesson?.id).slice(0, 4);

  return (
    <div className="flex flex-col gap-8">
      {/* An unpublished profile is invisible to students — say so first. */}
      {!profile.is_published ? (
        <Alert
          variant="warning"
          title={dict.unpublishedTitle}
          action={
            <Button size="sm" asChild>
              <Link href={`/${locale}/teacher/profile`}>{dict.completeProfile}</Link>
            </Button>
          }
        >
          {dict.unpublishedBody}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <h1 dir="auto" className="t-h1 text-ink">
          {dict.welcome.replace("{name}", profile.full_name || "")}
        </h1>
        <div className="flex flex-wrap items-center gap-2.5 t-small text-ink-muted">
          <Rating value={profile.rating_avg} count={profile.rating_count} size="sm" />
          <span aria-hidden className="text-ink-faint">
            ·
          </span>
          <span>{dict.lessonsTaught.replace("{n}", String(profile.lessons_count))}</span>
          <Badge variant={profile.is_published ? "success" : "neutral"} size="sm">
            {profile.is_published ? dict.published : dict.draft}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={<Hourglass aria-hidden />}
          label={dict.earningsPending}
          value={money(earnings.pending_minor, earnings.currency)}
        />
        <Stat
          icon={<Wallet aria-hidden />}
          label={dict.earningsPaid}
          value={money(earnings.paid_minor, earnings.currency)}
        />
        <Stat
          icon={<CalendarClock aria-hidden />}
          label={dict.upcoming}
          value={String(data.upcoming_count)}
        />
      </div>

      {requests.length > 0 ? (
        <Section
          title={dict.pendingRequests}
          href={`/${locale}/teacher/lessons`}
          viewAll={dict.viewAll}
        >
          {requests.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              locale={locale}
              bookingsDict={bookingsDict}
              icon={<Inbox aria-hidden />}
              tone="brand"
            />
          ))}
        </Section>
      ) : null}

      <Section title={dict.upcoming} href={`/${locale}/teacher/lessons`} viewAll={dict.viewAll}>
        {next_lesson ? (
          <Card className="flex flex-wrap items-center gap-4 border-brand/30 p-5">
            <span
              aria-hidden
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-card bg-brand-tint text-on-brand-tint"
            >
              <CalendarClock className="size-5.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="t-overline text-ink-faint">{dict.nextLesson}</span>
              <span dir="auto" className="t-h4 text-ink">
                {subjectLabel(next_lesson, locale)}
              </span>
              <span className="t-small text-ink-muted">
                <bdi>{next_lesson.student_name}</bdi> ·{" "}
                <bdi>{formatWhen(next_lesson.scheduled_start, locale)}</bdi> ·{" "}
                {next_lesson.duration_min} {dict.minutes}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {next_lesson.meeting_link ? (
                <Button asChild>
                  <a href={next_lesson.meeting_link} target="_blank" rel="noreferrer">
                    {dict.join}
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href={`/${locale}/teacher/lessons`}>{dict.allLessons}</Link>
              </Button>
            </div>
          </Card>
        ) : restUpcoming.length === 0 ? (
          /* `next_lesson` is the next FUTURE lesson, while the upcoming group is
             every confirmed one — so only say "nothing upcoming" when both are
             empty, or a past-dated confirmed lesson contradicts the line. */
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <span className="t-body text-ink-muted">{dict.noUpcoming}</span>
            <Link
              href={`/${locale}/teacher/calendar`}
              className="link-brand inline-flex items-center gap-1 t-small font-semibold"
            >
              {dict.linkCalendar}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </Link>
          </Card>
        ) : null}

        {restUpcoming.map((b) => (
          <BookingRow
            key={b.id}
            booking={b}
            locale={locale}
            bookingsDict={bookingsDict}
            icon={<CalendarClock aria-hidden />}
            tone="neutral"
          />
        ))}
      </Section>
    </div>
  );
}

function Section({
  title,
  href,
  viewAll,
  children,
}: {
  title: string;
  href: string;
  viewAll: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h3 text-ink">{title}</h2>
        <Link href={href} className="link-brand shrink-0 t-small font-semibold">
          {viewAll}
        </Link>
      </div>
      {children}
    </div>
  );
}

function BookingRow({
  booking,
  locale,
  bookingsDict,
  icon,
  tone,
}: {
  booking: Booking;
  locale: string;
  bookingsDict: BookingsDict;
  icon: React.ReactNode;
  tone: "brand" | "neutral";
}) {
  return (
    <Link href={`/${locale}/teacher/lessons`} className="block">
      <Card interactive className="flex items-center gap-3 p-3 sm:p-4">
        <span
          aria-hidden
          className={
            tone === "brand"
              ? "inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-tint text-on-brand-tint [&_svg]:size-4.5"
              : "inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-2 text-ink-muted [&_svg]:size-4.5"
          }
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span dir="auto" className="truncate t-small font-semibold text-ink">
            {subjectLabel(booking, locale)}
          </span>
          <span className="truncate t-caption text-ink-muted">
            <bdi>{booking.student_name}</bdi> ·{" "}
            <bdi>{formatWhen(booking.scheduled_start, locale)}</bdi>
          </span>
        </div>
        <StatusTag dict={bookingsDict} status={booking.status} />
      </Card>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-card" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 rounded-card" />
        <Skeleton className="h-16 rounded-card" />
      </div>
    </div>
  );
}
