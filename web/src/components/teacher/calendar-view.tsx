"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { Alert, Button, Spin, Tag } from "antd";

import { STATUS_COLORS, statusLabel } from "@/components/bookings/shared";
import type { Dictionary } from "@/i18n/dictionaries";
import { listBookings, type Booking } from "@/lib/bookings";
import { teacherSelf, type AvailabilityRule } from "@/lib/teacher-self";

type Dict = Dictionary["teacherCalendar"];
type BookingsDict = Dictionary["bookings"];

/** Weeks start on Saturday (common school-week start in EG/SA). */
const WEEK_START_DOW = 6;

function startOfWeek(d: dayjs.Dayjs): dayjs.Dayjs {
  const day = d.day(); // 0=Sun … 6=Sat
  const diff = (day - WEEK_START_DOW + 7) % 7;
  return d.subtract(diff, "day").startOf("day");
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
  const [weekStart, setWeekStart] = useState(() => startOfWeek(dayjs()));
  const [rules, setRules] = useState<AvailabilityRule[] | null>(null);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    teacherSelf
      .listAvailability()
      .then(setRules)
      .catch(() => {
        setRules([]);
        setError(bookingsDict.loadError);
      });
  }, [bookingsDict.loadError]);

  useEffect(() => {
    setBookings(null);
    listBookings(undefined, {
      from: weekStart.toISOString(),
      to: weekStart.add(7, "day").toISOString(),
      page_size: 100,
    })
      .then((res) => setBookings(res.results))
      .catch(() => {
        setBookings([]);
        setError(bookingsDict.loadError);
      });
  }, [weekStart, bookingsDict.loadError]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

  const loading = rules == null || bookings == null;

  const rulesFor = (day: dayjs.Dayjs) =>
    (rules ?? []).filter((r) => r.weekday === ((day.day() + 6) % 7));
  const bookingsFor = (day: dayjs.Dayjs) =>
    (bookings ?? [])
      .filter((b) => dayjs(b.scheduled_start).isSame(day, "day"))
      .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  if (error) return <Alert type="error" showIcon message={error} />;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {dict.title}
          </h1>
          <p className="mt-1 text-sm sm:text-base" style={{ color: "var(--ink-muted)" }}>
            {dict.intro}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setWeekStart((w) => w.subtract(7, "day"))}>‹</Button>
          <Button onClick={() => setWeekStart(startOfWeek(dayjs()))}>{dict.today}</Button>
          <Button onClick={() => setWeekStart((w) => w.add(7, "day"))}>›</Button>
          <span className="ms-2 text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
            {weekStart.toDate().toLocaleDateString(locale, { month: "short", day: "numeric" })} –{" "}
            {weekStart.add(6, "day").toDate().toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      ) : (
        <>
          {/* Mobile: agenda / day list */}
          <div className="flex flex-col gap-3 lg:hidden">
            {days.map((day) => {
              const dRules = rulesFor(day);
              const dBookings = bookingsFor(day);
              const isToday = day.isSame(dayjs(), "day");
              return (
                <div key={day.toString()} className="surface p-4">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-base font-bold" style={{ color: isToday ? "var(--brand)" : "var(--ink)" }}>
                      {day.toDate().toLocaleDateString(locale, { weekday: "long" })}
                    </span>
                    <span className="text-sm" style={{ color: "var(--ink-faint)" }}>
                      {day.toDate().toLocaleDateString(locale, { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {dRules.length === 0 && dBookings.length === 0 ? (
                    <span className="text-sm" style={{ color: "var(--ink-faint)" }}>—</span>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dRules.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {dRules.map((r) => (
                            <AvailChip key={r.id} rule={r} />
                          ))}
                        </div>
                      )}
                      {dBookings.map((b) => (
                        <BookingItem key={b.id} booking={b} locale={locale} bookingsDict={bookingsDict} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop: week grid */}
          <div className="surface hidden overflow-hidden lg:block">
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const isToday = day.isSame(dayjs(), "day");
                return (
                  <div
                    key={day.toString()}
                    className="flex min-h-64 flex-col gap-2 p-3"
                    style={{
                      borderInlineEnd: "1px solid var(--border)",
                      background: isToday ? "var(--brand-tint)" : "transparent",
                    }}
                  >
                    <div className="text-center">
                      <div className="text-xs font-medium uppercase" style={{ color: "var(--ink-muted)" }}>
                        {day.toDate().toLocaleDateString(locale, { weekday: "short" })}
                      </div>
                      <div className="text-lg font-bold" style={{ color: isToday ? "var(--brand)" : "var(--ink)" }}>
                        {day.date()}
                      </div>
                    </div>
                    {rulesFor(day).map((r) => (
                      <AvailChip key={r.id} rule={r} />
                    ))}
                    {bookingsFor(day).map((b) => (
                      <BookingItem key={b.id} booking={b} locale={locale} bookingsDict={bookingsDict} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "var(--ink-muted)" }}>
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-3 w-6 rounded"
            style={{ background: "var(--brand-tint)", border: "1px dashed var(--brand)" }}
          />
          {dict.legendAvailability}
        </span>
        <Link href={`/${locale}/teacher/profile`} className="link-brand font-semibold">
          {dict.editAvailability}
        </Link>
      </div>
    </section>
  );
}

function AvailChip({ rule }: { rule: AvailabilityRule }) {
  return (
    <div
      className="rounded-md px-2 py-1 text-center text-[11px] font-medium"
      style={{ background: "var(--brand-tint)", color: "var(--brand-dark)", border: "1px dashed var(--brand)" }}
    >
      {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}
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
      className="item-hover block rounded-md px-2 py-1.5 text-xs"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="font-semibold" style={{ color: "var(--ink)" }}>
        {new Date(booking.scheduled_start).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} ·{" "}
        {booking.student_name}
      </div>
      <Tag color={STATUS_COLORS[booking.status]} className="mt-1">
        {statusLabel(bookingsDict, booking.status)}
      </Tag>
    </Link>
  );
}
