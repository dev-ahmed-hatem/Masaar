"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, type Booking } from "@/lib/bookings";

import {
  LESSONS_PAGE_SIZE,
  PROVIDERS,
  StatusTag,
  formatWhen,
  subjectLabel,
  useGroupedBookings,
  type BookingGroup,
} from "@/components/bookings/shared";
import { PageHeader, Panel } from "@/components/ui";

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
          <Popconfirm
            title={dict.cancelConfirm}
            okText={dict.cancel}
            okButtonProps={{ danger: true }}
            onConfirm={() => run(() => bookingActions.cancel(b.id, ""), dict.cancelled)}
          >
            <Button size="small" danger>
              {dict.cancel}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={dict.noShowConfirm}
            okText={dict.noShow}
            onConfirm={() => run(() => bookingActions.noShow(b.id), dict.noShowDone)}
          >
            <Button size="small">{dict.noShow}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderTab = (name: BookingGroup, columns: ColumnsType<Booking>) => {
    const g = groups[name];
    return (
      <Panel>
        <Table<Booking>
          rowKey="id"
          columns={columns}
          dataSource={g.rows}
          loading={loading}
          pagination={{
            current: g.page,
            pageSize: LESSONS_PAGE_SIZE,
            total: g.total,
            showSizeChanger: false,
            hideOnSinglePage: true,
            onChange: (p) => setPage(name, p),
          }}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
        />
      </Panel>
    );
  };

  if (error) return <Alert type="error" message={error} showIcon />;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.teacherTitle} subtitle={dict.teacherIntro} />

      <Tabs
        items={[
          { key: "requests", label: `${dict.tabRequests} (${groups.requested.total})`, children: renderTab("requested", requestColumns) },
          { key: "upcoming", label: `${dict.tabUpcoming} (${groups.upcoming.total})`, children: renderTab("upcoming", upcomingColumns) },
          { key: "past", label: dict.tabPast, children: renderTab("past", baseColumns()) },
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
