"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { StatusTag } from "@/components/bookings/shared";
import type { Dictionary } from "@/i18n/dictionaries";
import { listBookings, type Booking } from "@/lib/bookings";
import { cn } from "@/lib/cn";
import { stageCardTitle, type WeeklyWindow } from "@/lib/stage-cards";
import { teacherSelf } from "@/lib/teacher-self";
import { useRefreshOnFocus } from "@/lib/use-refresh-on-focus";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Dict = Dictionary["teacherCalendar"];
type BookingsDict = Dictionary["bookings"];

/** A weekly window tagged with the stage card it belongs to. */
interface CalendarRule extends WeeklyWindow {
  key: string;
  stage: string;
}

/** Weeks start on Saturday (the school week in EG/SA). */
const WEEK_START_DOW = 6;

function startOfWeek(from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - WEEK_START_DOW + 7) % 7));
  return d;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarView({
  dict,
  bookingsDict,
  locale,
}: {
  dict: Dict;
  bookingsDict: BookingsDict;
  locale: string;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [rules, setRules] = useState<CalendarRule[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teacherSelf
      .listStages()
      .then((cards) =>
        setRules(
          cards.flatMap((card) =>
            card.availability.map((w, i) => ({
              ...w,
              key: `${card.id}-${i}`,
              stage: stageCardTitle(card, locale),
            })),
          ),
        ),
      )
      .catch(() => {
        setRules([]);
        setError(dict.loadError);
      });
  }, [dict.loadError, locale]);

  const loadBookings = useCallback(
    (showSkeleton: boolean) => {
      if (showSkeleton) setBookings(null);
      return listBookings(undefined, {
        from: weekStart.toISOString(),
        to: addDays(weekStart, 7).toISOString(),
        page_size: 100,
      })
        .then((res) => setBookings(res.results))
        .catch(() => {
          setBookings([]);
          setError(dict.loadError);
        });
    },
    [weekStart, dict.loadError],
  );

  useEffect(() => {
    loadBookings(true);
  }, [loadBookings]);

  // Reflect student-initiated reschedules/cancels on the open tab (no skeleton).
  const refresh = useCallback(() => loadBookings(false), [loadBookings]);
  useRefreshOnFocus(refresh);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const loading = rules == null || bookings == null;
  const today = new Date();

  const rulesFor = (day: Date) =>
    (rules ?? [])
      // Rule weekdays are Monday-first; JS is Sunday-first.
      .filter((r) => r.weekday === (day.getDay() + 6) % 7)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const bookingsFor = (day: Date) =>
    (bookings ?? [])
      // Cancelled/declined lessons free their slot, so don't render them as busy.
      .filter((b) => b.status !== "CANCELLED" && b.status !== "DECLINED")
      .filter((b) => sameDay(new Date(b.scheduled_start), day))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  const rangeLabel = `${weekStart.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  })} – ${addDays(weekStart, 6).toLocaleDateString(locale, { month: "short", day: "numeric" })}`;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="t-h1 text-ink">{dict.title}</h1>
          <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={dict.prevWeek}
            onClick={() => setWeekStart((w) => addDays(w, -7))}
          >
            <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            {dict.today}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={dict.nextWeek}
            onClick={() => setWeekStart((w) => addDays(w, 7))}
          >
            <ChevronRight className="rtl:-scale-x-100" aria-hidden />
          </Button>
          <span dir="auto" className="ms-1 t-small font-medium text-ink-muted">
            {rangeLabel}
          </span>
        </div>
      </header>

      {error ? <Alert variant="error" title={error} /> : null}

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-7" aria-busy>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-card lg:h-64" />
          ))}
        </div>
      ) : (
        <>
          {/* Mobile: a day-by-day agenda. A 7-column grid is unreadable at 390px. */}
          <div className="flex flex-col gap-3 lg:hidden">
            {days.map((day) => {
              const dayRules = rulesFor(day);
              const dayBookings = bookingsFor(day);
              const isToday = sameDay(day, today);
              return (
                <Card key={day.toISOString()} className={cn("p-4", isToday && "border-brand/40")}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <span
                      className={cn("t-body font-bold", isToday ? "text-brand" : "text-ink")}
                    >
                      {day.toLocaleDateString(locale, { weekday: "long" })}
                    </span>
                    <span className="t-caption text-ink-faint">
                      {day.toLocaleDateString(locale, { month: "short", day: "numeric" })}
                    </span>
                  </div>

                  {dayRules.length === 0 && dayBookings.length === 0 ? (
                    <span className="t-small text-ink-faint">{dict.nothingToday}</span>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dayRules.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {dayRules.map((r) => (
                            <AvailChip key={r.key} rule={r} />
                          ))}
                        </div>
                      ) : null}
                      {dayBookings.map((b) => (
                        <BookingItem
                          key={b.id}
                          booking={b}
                          locale={locale}
                          bookingsDict={bookingsDict}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Desktop: the week at a glance. */}
          <Card className="hidden overflow-hidden lg:block">
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const isToday = sameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex min-h-64 flex-col gap-2 p-3",
                      i < 6 && "border-e border-border",
                      isToday && "bg-brand-tint",
                    )}
                  >
                    <div className="text-center">
                      <div className="t-overline text-ink-muted">
                        {day.toLocaleDateString(locale, { weekday: "short" })}
                      </div>
                      <div
                        className={cn(
                          "font-display text-lg font-bold",
                          isToday ? "text-on-brand-tint" : "text-ink",
                        )}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                    {rulesFor(day).map((r) => (
                      <AvailChip key={r.key} rule={r} />
                    ))}
                    {bookingsFor(day).map((b) => (
                      <BookingItem
                        key={b.id}
                        booking={b}
                        locale={locale}
                        bookingsDict={bookingsDict}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 t-small text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-6 rounded-control border border-dashed border-brand bg-brand-tint"
          />
          {dict.legendAvailability}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-6 rounded-control border border-border bg-surface"
          />
          {dict.legendLesson}
        </span>
        <Link href={`/${locale}/teacher/profile`} className="link-brand font-semibold">
          {dict.editAvailability}
        </Link>
      </div>
    </section>
  );
}

function AvailChip({ rule }: { rule: CalendarRule }) {
  return (
    <div
      title={rule.stage}
      className="rounded-control border border-dashed border-brand bg-brand-tint px-2 py-1 text-center t-caption font-medium text-on-brand-tint"
    >
      <div dir="ltr">
        {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
      </div>
      <div dir="auto" className="truncate opacity-80">
        {rule.stage}
      </div>
    </div>
  );
}

function BookingItem({
  booking,
  locale,
  bookingsDict,
}: {
  booking: Booking;
  locale: string;
  bookingsDict: BookingsDict;
}) {
  return (
    <Link
      href={`/${locale}/teacher/lessons`}
      className="block rounded-control border border-border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-sm"
    >
      <div className="t-caption font-semibold text-ink">
        <bdi>
          {new Date(booking.scheduled_start).toLocaleTimeString(locale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </bdi>{" "}
        · <bdi>{booking.student_name}</bdi>
      </div>
      <div className="mt-1">
        <StatusTag dict={bookingsDict} status={booking.status} />
      </div>
    </Link>
  );
}
