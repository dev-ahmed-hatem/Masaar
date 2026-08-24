"use client";

import { useCallback, useState } from "react";
import { Alert, App, Button, Empty, Form, Input, Modal, Pagination, Popconfirm, Select, Spin } from "antd";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, type Booking } from "@/lib/bookings";

import {
  LESSONS_PAGE_SIZE,
  LessonCard,
  PROVIDERS,
  useGroupedBookings,
  type BookingGroup,
} from "@/components/bookings/shared";
import { SegmentedTabs } from "@/components/ui";

type Dict = Dictionary["bookings"];

export default function LessonsManager({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const { groups, loading, error, reload, setPage } = useGroupedBookings(dict.loadError);
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [form] = Form.useForm();

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

  const [tab, setTab] = useState<BookingGroup>("requested");

  function actionsFor(b: Booking, group: BookingGroup) {
    if (group === "requested") {
      return (
        <>
          <Button type="primary" size="small" onClick={() => setConfirming(b)}>{dict.confirm}</Button>
          <Button size="small" onClick={() => run(() => bookingActions.decline(b.id), dict.declined)}>{dict.decline}</Button>
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
          <Popconfirm
            title={dict.cancelConfirm}
            okText={dict.cancel}
            okButtonProps={{ danger: true }}
            onConfirm={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}
          >
            <Button size="small" danger>{dict.cancel}</Button>
          </Popconfirm>
          <Popconfirm
            title={dict.noShowConfirm}
            okText={dict.noShow}
            onConfirm={() => run(() => bookingActions.noShow(b.id), dict.noShowDone)}
          >
            <Button size="small">{dict.noShow}</Button>
          </Popconfirm>
        </>
      );
    }
    return null;
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
            bookingsDict={dict}
            locale={locale}
            who={b.student_name}
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
        {dict.teacherTitle}
      </h1>

      <SegmentedTabs
        value={tab}
        onChange={(v) => setTab(v as BookingGroup)}
        options={[
          { value: "requested", label: dict.tabRequests, badge: groups.requested.total },
          { value: "upcoming", label: dict.tabUpcoming, badge: groups.upcoming.total },
          { value: "past", label: dict.tabPast },
        ]}
      />

      {renderList(tab)}

      <Modal
        open={confirming !== null}
        title={dict.confirmTitle}
        okText={dict.submit}
        onCancel={() => setConfirming(null)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ meeting_provider: "ZOOM" }}
          onFinish={async (values) => {
            if (!confirming) return;
            await run(
              () => bookingActions.confirm(confirming.id, values.meeting_provider, values.meeting_link),
              dict.confirmed,
            );
            setConfirming(null);
            form.resetFields();
          }}
        >
          <Form.Item name="meeting_provider" label={dict.provider} rules={[{ required: true }]}>
            <Select options={PROVIDERS} />
          </Form.Item>
          <Form.Item
            name="meeting_link"
            label={dict.meetingLink}
            rules={[{ required: true, type: "url" }]}
          >
            <Input placeholder="https://" inputMode="url" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
