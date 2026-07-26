"use client";

import { useEffect, useState } from "react";
import { Alert, Empty, Spin, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { PageHeader, Panel } from "@/components/ui";
import { myPayouts, type ItemStatus, type PayoutItem } from "@/lib/payouts";

type Dict = Dictionary["teacherEarnings"];

const COLORS: Record<ItemStatus, string> = { PENDING: "gold", PAID: "green" };

export default function EarningsView({ dict }: { dict: Dict }) {
  const [rows, setRows] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myPayouts()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  const totalPaid = rows
    .filter((r) => r.status === "PAID")
    .reduce((sum, r) => sum + r.amount_minor, 0);
  const currency = rows[0]?.currency ?? "";

  const columns: ColumnsType<PayoutItem> = [
    { title: dict.colLessons, dataIndex: "lessons_count", key: "lessons" },
    { title: dict.colAmount, key: "amount", render: (_, r) => r.amount_display },
    {
      title: dict.colPeriodStatus,
      key: "status",
      render: (_, r) => (
        <Tag color={COLORS[r.status]}>{r.status === "PAID" ? dict.statusPAID : dict.statusPENDING}</Tag>
      ),
    },
    { title: dict.colReference, key: "ref", render: (_, r) => r.reference || "—" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <>
          {totalPaid > 0 && (
            <div className="surface px-5 py-4" style={{ maxWidth: 260 }}>
              <div className="text-xs font-medium" style={{ color: "var(--ink-muted)" }}>
                {dict.totalPaid}
              </div>
              <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                {(totalPaid / 100).toFixed(2)}{" "}
                <span className="text-base font-normal" style={{ color: "var(--ink-muted)" }}>
                  {currency}
                </span>
              </div>
            </div>
          )}
          <Panel>
            <Table<PayoutItem>
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              locale={{ emptyText: <Empty description={dict.empty} /> }}
            />
          </Panel>
        </>
      )}
    </section>
  );
}
