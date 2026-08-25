"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, App, Button, Empty, Input, Modal, Pagination, Rate, Spin } from "antd";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, listSlots, rescheduleBooking, type Booking, type Slot } from "@/lib/bookings";
import { createReview } from "@/lib/reviews";
import {
  LESSONS_PAGE_SIZE,
  LessonCard,
  useGroupedBookings,
  type BookingGroup,
} from "@/components/bookings/shared";
import SlotCalendar from "@/components/bookings/slot-calendar";
import { SegmentedTabs } from "@/components/ui";

type Dict = Dictionary["myLessons"];
type BookingsDict = Dictionary["bookings"];

export default function StudentLessons({
  dict,
  bookingsDict,
  locale,
}: {
  dict: Dict;
  bookingsDict: BookingsDict;
  locale: Locale;
}) {
  const { message, modal } = App.useApp();
  const { groups, loading, error, reload, setPage } = useGroupedBookings(dict.loadError);
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        message.success(ok);
        reload();
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : dict.actionError);
      }
    },
    [message, reload, dict.actionError],
  );

  function confirmCancel(b: Booking) {
    modal.confirm({
      title: dict.cancel,
      content: dict.cancelConfirm,
      okText: dict.cancel,
      okButtonProps: { danger: true },
      onOk: () => run(() => bookingActions.cancel(b.id, ""), dict.cancelled),
    });
  }

  const [tab, setTab] = useState<BookingGroup>("upcoming");

  function actionsFor(b: Booking, group: BookingGroup) {
    if (group === "requested") {
      return (
        <>
          <Button size="small" onClick={() => setRescheduling(b)}>{dict.reschedule}</Button>
          <Button size="small" danger onClick={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}>{dict.cancel}</Button>
        </>
      );
    }
    if (group === "upcoming") {
      return (
        <>
          {b.meeting_link && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer" className="link-brand text-sm font-semibold">
              {dict.join} ↗
            </a>
          )}
          <Button size="small" onClick={() => setRescheduling(b)}>{dict.reschedule}</Button>
          <Button size="small" onClick={() => run(() => bookingActions.complete(b.id), dict.completed)}>{dict.complete}</Button>
          <Button size="small" danger onClick={() => confirmCancel(b)}>{dict.cancel}</Button>
        </>
      );
    }
    return b.status === "COMPLETED" && !reviewedIds.has(b.id) ? (
      <Button size="small" onClick={() => setReviewing(b)}>{dict.review}</Button>
    ) : null;
  }

  function renderList(group: BookingGroup) {
    const g = groups[group];
    if (loading) return <div className="flex justify-center py-16"><Spin /></div>;
    if (g.rows.length === 0) return <Empty description={dict.empty} className="py-12" />;
    return (
      <div className="flex flex-col gap-3">
        {g.rows.map((b) => (
          <LessonCard
            key={b.id}
            booking={b}
            bookingsDict={bookingsDict}
            locale={locale}
            who={b.teacher_name}
            price={b.is_trial ? dict.trial : b.price_display}
            actions={actionsFor(b, group)}
          />
        ))}
        {g.total > LESSONS_PAGE_SIZE && (
          <div className="flex justify-center pt-2">
            <Pagination current={g.page} pageSize={LESSONS_PAGE_SIZE} total={g.total} showSizeChanger={false} onChange={(p) => setPage(group, p)} />
          </div>
        )}
      </div>
    );
  }

  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {dict.title}
      </h1>

      <SegmentedTabs
        value={tab}
        onChange={(v) => setTab(v as BookingGroup)}
        options={[
          { value: "upcoming", label: dict.tabUpcoming, badge: groups.upcoming.total },
          { value: "requested", label: dict.tabRequested, badge: groups.requested.total },
          { value: "past", label: dict.tabPast },
        ]}
      />

      {renderList(tab)}

      {reviewing && (
        <ReviewModal
          booking={reviewing}
          dict={dict}
          onClose={() => setReviewing(null)}
          onDone={(id) => {
            setReviewedIds((prev) => new Set(prev).add(id));
            setReviewing(null);
          }}
        />
      )}

      {rescheduling && (
        <RescheduleModal
          booking={rescheduling}
          dict={dict}
          locale={locale}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function RescheduleModal({
  booking,
  dict,
  locale,
  onClose,
  onDone,
}: {
  booking: Booking;
  dict: Dict;
  locale: Locale;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [start, setStart] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    listSlots(booking.teacher_id)
      .then((s) => active && setSlots(s))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [booking.teacher_id]);

  async function submit() {
    if (!start) return;
    setSubmitting(true);
    try {
      await rescheduleBooking(booking.id, { scheduled_start: start });
      message.success(dict.rescheduled);
      onDone();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      width={640}
      onCancel={onClose}
      onOk={submit}
      title={dict.rescheduleTitle}
      okButtonProps={{ disabled: !start, loading: submitting }}
    >
      <div className="py-2">
        {loadingSlots ? (
          <div className="flex justify-center py-6"><Spin /></div>
        ) : slots.length === 0 ? (
          <Empty description="—" />
        ) : (
          <SlotCalendar slots={slots} selected={start} onPick={setStart} locale={locale} />
        )}
      </div>
    </Modal>
  );
}

function ReviewModal({
  booking,
  dict,
  onClose,
  onDone,
}: {
  booking: Booking;
  dict: Dict;
  onClose: () => void;
  onDone: (bookingId: number) => void;
}) {
  const { message } = App.useApp();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await createReview({ booking: booking.id, rating, text });
      message.success(dict.reviewSuccess);
      onDone(booking.id);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "already_reviewed") {
        message.error(dict.alreadyReviewed);
        onDone(booking.id);
      } else {
        message.error(err instanceof ApiError ? err.message : dict.actionError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onCancel={onClose} onOk={submit} title={dict.reviewTitle} okText={dict.submitReview} okButtonProps={{ loading: submitting }}>
      <div className="flex flex-col gap-4 py-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.rating}</span>
          <Rate value={rating} onChange={setRating} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.reviewText}</span>
          <Input.TextArea rows={4} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        </label>
      </div>
    </Modal>
  );
}
