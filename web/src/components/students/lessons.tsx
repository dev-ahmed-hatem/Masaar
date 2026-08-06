"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App, Button, Empty, Input, Modal, Rate, Select, Space, Spin, Table, Tabs } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, listBookings, listSlots, rescheduleBooking, type Booking, type Slot } from "@/lib/bookings";
import { createReview } from "@/lib/reviews";
import { StatusTag, formatWhen, subjectLabel } from "@/components/bookings/shared";
import { PageHeader, Panel } from "@/components/ui";

type Dict = Dictionary["myLessons"];
type BookingsDict = Dictionary["bookings"];

const PAST: Booking["status"][] = ["COMPLETED", "DECLINED", "CANCELLED", "DISPUTED", "NO_SHOW"];

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
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [rescheduling, setRescheduling] = useState<Booking | null>(null);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());

  const load = useCallback(() => {
    setLoading(true);
    listBookings()
      .then((res) => setBookings(res.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        message.success(ok);
        load();
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : dict.actionError);
      }
    },
    [message, load, dict.actionError],
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

  const groups = useMemo(
    () => ({
      CONFIRMED: bookings.filter((b) => b.status === "CONFIRMED"),
      REQUESTED: bookings.filter((b) => b.status === "REQUESTED"),
      PAST: bookings.filter((b) => PAST.includes(b.status)),
    }),
    [bookings],
  );

  function baseColumns(): ColumnsType<Booking> {
    return [
      { title: dict.colWhen, key: "when", render: (_, b) => formatWhen(b.scheduled_start, locale) },
      { title: dict.colTeacher, dataIndex: "teacher_name", key: "teacher" },
      { title: dict.colSubject, key: "subject", render: (_, b) => subjectLabel(b, locale) },
      { title: dict.colPrice, key: "price", render: (_, b) => (b.is_trial ? dict.trial : b.price_display) },
      { title: dict.colStatus, key: "status", render: (_, b) => <StatusTag dict={bookingsDict} status={b.status} /> },
    ];
  }

  const requestedColumns: ColumnsType<Booking> = [
    ...baseColumns(),
    {
      title: "",
      key: "actions",
      render: (_, b) => (
        <Space wrap>
          <Button size="small" onClick={() => setRescheduling(b)}>
            {dict.reschedule}
          </Button>
          <Button size="small" danger onClick={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}>
            {dict.cancel}
          </Button>
        </Space>
      ),
    },
  ];

  const upcomingColumns: ColumnsType<Booking> = [
    ...baseColumns(),
    {
      title: "",
      key: "actions",
      render: (_, b) => (
        <Space wrap>
          {b.meeting_link && (
            <a href={b.meeting_link} target="_blank" rel="noreferrer">
              {dict.join} ↗
            </a>
          )}
          <Button size="small" onClick={() => setRescheduling(b)}>
            {dict.reschedule}
          </Button>
          <Button size="small" onClick={() => run(() => bookingActions.complete(b.id), dict.completed)}>
            {dict.complete}
          </Button>
          <Button size="small" danger onClick={() => confirmCancel(b)}>
            {dict.cancel}
          </Button>
        </Space>
      ),
    },
  ];

  const pastColumns: ColumnsType<Booking> = [
    ...baseColumns(),
    {
      title: "",
      key: "actions",
      render: (_, b) =>
        b.status === "COMPLETED" && !reviewedIds.has(b.id) ? (
          <Button size="small" onClick={() => setReviewing(b)}>
            {dict.review}
          </Button>
        ) : null,
    },
  ];

  const tab = (rows: Booking[], columns: ColumnsType<Booking>) => (
    <Panel>
      <Table<Booking>
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        locale={{ emptyText: <Empty description={dict.empty} /> }}
      />
    </Panel>
  );

  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      <Tabs
        items={[
          { key: "upcoming", label: `${dict.tabUpcoming} (${groups.CONFIRMED.length})`, children: tab(groups.CONFIRMED, upcomingColumns) },
          { key: "requested", label: `${dict.tabRequested} (${groups.REQUESTED.length})`, children: tab(groups.REQUESTED, requestedColumns) },
          { key: "past", label: dict.tabPast, children: tab(groups.PAST, pastColumns) },
        ]}
      />

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
            load();
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

  const groups = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const key = new Date(s.start).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" });
    (acc[key] ??= []).push(s);
    return acc;
  }, {});
  const options = Object.entries(groups).map(([label, items]) => ({
    label,
    options: items.map((s) => ({
      label: new Date(s.start).toLocaleTimeString(locale, { timeStyle: "short" }),
      value: s.start,
    })),
  }));

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
          <Select value={start} onChange={setStart} options={options} style={{ width: "100%" }} />
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
