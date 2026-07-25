"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, listBookings, type Booking } from "@/lib/bookings";

import { PROVIDERS, StatusTag, formatWhen, subjectLabel } from "@/components/bookings/shared";

type Dict = Dictionary["bookings"];

const { Title, Paragraph } = Typography;

const PAST: Booking["status"][] = ["COMPLETED", "DECLINED", "CANCELLED", "DISPUTED", "NO_SHOW"];

export default function LessonsManager({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [form] = Form.useForm();

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

  const groups = useMemo(
    () => ({
      REQUESTED: bookings.filter((b) => b.status === "REQUESTED"),
      CONFIRMED: bookings.filter((b) => b.status === "CONFIRMED"),
      PAST: bookings.filter((b) => PAST.includes(b.status)),
    }),
    [bookings],
  );

  function baseColumns(): ColumnsType<Booking> {
    return [
      { title: dict.colWhen, key: "when", render: (_, b) => formatWhen(b.scheduled_start, locale) },
      { title: dict.colStudent, dataIndex: "student_name", key: "student" },
      { title: dict.colSubject, key: "subject", render: (_, b) => subjectLabel(b, locale) },
      {
        title: dict.colPrice,
        key: "price",
        render: (_, b) => (b.is_trial ? dict.trial : b.price_display),
      },
      { title: dict.colStatus, key: "status", render: (_, b) => <StatusTag dict={dict} status={b.status} /> },
    ];
  }

  const requestColumns: ColumnsType<Booking> = [
    ...baseColumns(),
    {
      title: "",
      key: "actions",
      render: (_, b) => (
        <Space>
          <Button type="primary" size="small" onClick={() => setConfirming(b)}>
            {dict.confirm}
          </Button>
          <Button size="small" onClick={() => run(() => bookingActions.decline(b.id), dict.declined)}>
            {dict.decline}
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
          <Button size="small" danger onClick={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}>
            {dict.cancel}
          </Button>
          <Button size="small" onClick={() => run(() => bookingActions.noShow(b.id), dict.noShowDone)}>
            {dict.noShow}
          </Button>
        </Space>
      ),
    },
  ];

  const tab = (rows: Booking[], columns: ColumnsType<Booking>) => (
    <Table<Booking>
      rowKey="id"
      columns={columns}
      dataSource={rows}
      loading={loading}
      pagination={false}
      locale={{ emptyText: <Empty description={dict.empty} /> }}
    />
  );

  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {dict.teacherTitle}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {dict.teacherIntro}
        </Paragraph>
      </div>

      <Tabs
        items={[
          {
            key: "requests",
            label: `${dict.tabRequests} (${groups.REQUESTED.length})`,
            children: tab(groups.REQUESTED, requestColumns),
          },
          {
            key: "upcoming",
            label: `${dict.tabUpcoming} (${groups.CONFIRMED.length})`,
            children: tab(groups.CONFIRMED, upcomingColumns),
          },
          { key: "past", label: dict.tabPast, children: tab(groups.PAST, baseColumns()) },
        ]}
      />

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
