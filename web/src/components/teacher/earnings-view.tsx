"use client";

import { useEffect, useState } from "react";
import { Alert, Empty, Spin, Tag } from "antd";
import { Hourglass, Wallet } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { ListRow, SummaryStrip } from "@/components/ui";
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

  const sum = (status: ItemStatus) =>
    rows.filter((r) => r.status === status).reduce((s, r) => s + r.amount_minor, 0);
  const currency = rows[0]?.currency ?? "";
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${currency}`;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {dict.title}
      </h1>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : rows.length === 0 ? (
        <Empty description={dict.empty} className="py-12" />
      ) : (
        <>
          <SummaryStrip
            items={[
              { label: dict.totalPaid, value: money(sum("PAID")), icon: <Wallet size={18} /> },
              { label: dict.totalPending, value: money(sum("PENDING")), icon: <Hourglass size={18} /> },
            ]}
          />
          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <ListRow
                key={r.id}
                title={r.amount_display}
                subtitle={`${r.lessons_count} ${dict.colLessons}${r.reference ? ` · ${r.reference}` : ""}`}
                trailing={
                  <Tag color={COLORS[r.status]} bordered={false} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {r.status === "PAID" ? dict.statusPAID : dict.statusPENDING}
                  </Tag>
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
