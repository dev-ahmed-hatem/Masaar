"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { bookingActions, listBookings, type Booking, type BookingStatus } from "@/lib/bookings";

import { StatusTag, formatWhen, subjectLabel } from "@/components/bookings/shared";

type Dict = Dictionary["bookings"];

const { Title, Paragraph, Text } = Typography;

const STATUSES: BookingStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "DECLINED",
  "DISPUTED",
  "NO_SHOW",
];

export default function BookingsView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listBookings(status || undefined)
      .then((res) => setRows(res.results))
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [status, dict.loadError]);

  useEffect(() => load(), [load]);

  async function resolve(id: number, complete: boolean) {
    try {
      await bookingActions.resolve(id, complete);
      message.success(dict.resolved);
      setSelected(null);
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    }
  }

  const columns: ColumnsType<Booking> = [
    { title: dict.colWhen, key: "when", render: (_, b) => formatWhen(b.scheduled_start, locale) },
    { title: dict.colStudent, dataIndex: "student_name", key: "student" },
    { title: dict.colTeacher, dataIndex: "teacher_name", key: "teacher" },
    { title: dict.colSubject, key: "subject", render: (_, b) => subjectLabel(b, locale) },
    { title: dict.colPrice, key: "price", render: (_, b) => (b.is_trial ? dict.trial : b.price_display) },
    { title: dict.colStatus, key: "status", render: (_, b) => <StatusTag dict={dict} status={b.status} /> },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {dict.adminTitle}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {dict.adminIntro}
        </Paragraph>
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ maxWidth: 220 }}>
        <span className="opacity-60">{dict.filterStatus}</span>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: dict.allStatuses },
            ...STATUSES.map((s) => ({ value: s, label: dict[`status${s}` as keyof Dict] as string })),
          ]}
        />
      </label>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Table<Booking>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          onRow={(b) => ({ onClick: () => setSelected(b), style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
          pagination={{ showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)) }}
        />
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={420}
        placement={locale === "ar" ? "left" : "right"}
        title={selected ? `#${selected.id}` : ""}
      >
        {selected && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <StatusTag dict={dict} status={selected.status} />
            <Field label={dict.colWhen} value={formatWhen(selected.scheduled_start, locale)} />
            <Field label={dict.colStudent} value={selected.student_name} />
            <Field label={dict.colTeacher} value={selected.teacher_name} />
            <Field label={dict.colSubject} value={subjectLabel(selected, locale)} />
            <Field label={dict.colPrice} value={selected.is_trial ? dict.trial : selected.price_display} />
            {selected.meeting_link && (
              <a href={selected.meeting_link} target="_blank" rel="noreferrer">
                {dict.join} ↗
              </a>
            )}
            {selected.cancel_reason && <Text type="secondary">“{selected.cancel_reason}”</Text>}

            {selected.status === "DISPUTED" && (
              <Space>
                <Button type="primary" onClick={() => resolve(selected.id, true)}>
                  {dict.resolveComplete}
                </Button>
                <Button danger onClick={() => resolve(selected.id, false)}>
                  {dict.resolveCancel}
                </Button>
              </Space>
            )}
          </Space>
        )}
      </Drawer>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="opacity-60">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}
