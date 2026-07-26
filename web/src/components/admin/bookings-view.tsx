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
import { DetailRow, FilterField, PageHeader, Panel } from "@/components/ui";

type Dict = Dictionary["bookings"];

const { Text } = Typography;

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

  const filters = (
    <FilterField label={dict.filterStatus}>
      <Select
        value={status}
        onChange={setStatus}
        style={{ width: 220 }}
        options={[
          { value: "", label: dict.allStatuses },
          ...STATUSES.map((s) => ({ value: s, label: dict[`status${s}` as keyof Dict] as string })),
        ]}
      />
    </FilterField>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.adminTitle} subtitle={dict.adminIntro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Panel toolbar={filters}>
          <Table<Booking>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            onRow={(b) => ({ onClick: () => setSelected(b), style: { cursor: "pointer" } })}
            locale={{ emptyText: <Empty description={dict.empty} /> }}
            pagination={{ showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)) }}
          />
        </Panel>
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
            <DetailRow label={dict.colWhen} value={formatWhen(selected.scheduled_start, locale)} />
            <DetailRow label={dict.colStudent} value={selected.student_name} />
            <DetailRow label={dict.colTeacher} value={selected.teacher_name} />
            <DetailRow label={dict.colSubject} value={subjectLabel(selected, locale)} />
            <DetailRow label={dict.colPrice} value={selected.is_trial ? dict.trial : selected.price_display} />
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
