"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Drawer,
  Empty,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { approveReceipt, listReceipts, rejectReceipt, type Receipt, type ReceiptStatus } from "@/lib/receipts";

type Dict = Dictionary["adminReceipts"];

const { Title, Paragraph, Text } = Typography;

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
};

const STATUSES: ReceiptStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export default function ReceiptsQueue({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<string>("PENDING");
  const [rows, setRows] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [reason, setReason] = useState("");
  const [acting, setActing] = useState(false);

  const tr = useCallback((prefix: string, key: string) => dict[`${prefix}${key}` as keyof Dict] as string, [dict]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listReceipts(status || undefined)
      .then((data) => setRows(data.results))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [status, dict.loadError]);

  useEffect(() => load(), [load]);

  async function act(kind: "approve" | "reject") {
    if (!selected) return;
    setActing(true);
    try {
      if (kind === "approve") {
        await approveReceipt(selected.id);
        message.success(dict.approved);
      } else {
        await rejectReceipt(selected.id, reason);
        message.success(dict.rejected);
      }
      setSelected(null);
      setReason("");
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setActing(false);
    }
  }

  const columns: ColumnsType<Receipt> = [
    { title: dict.colStudent, dataIndex: "user_name", key: "student" },
    { title: dict.colAmount, key: "amount", render: (_, r) => r.amount_display },
    { title: dict.colMethod, key: "method", render: (_, r) => tr("method", r.method) },
    { title: dict.colPurpose, key: "purpose", render: (_, r) => tr("purpose", r.purpose) },
    {
      title: dict.colStatus,
      key: "status",
      render: (_, r) => <Tag color={STATUS_COLORS[r.status]}>{tr("status", r.status)}</Tag>,
    },
    { title: dict.colSubmitted, key: "when", render: (_, r) => new Date(r.created_at).toLocaleDateString(locale) },
  ];

  return (
    <section className="flex flex-col gap-5">
      <div>
        <Title level={3} style={{ marginBottom: 4 }}>
          {dict.title}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {dict.intro}
        </Paragraph>
      </div>

      <label className="flex flex-col gap-1 text-xs" style={{ maxWidth: 220 }}>
        <span className="opacity-60">{dict.filterStatus}</span>
        <Select
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: dict.allStatuses },
            ...STATUSES.map((s) => ({ value: s, label: tr("status", s) })),
          ]}
        />
      </label>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Table<Receipt>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          onRow={(r) => ({ onClick: () => { setSelected(r); setReason(""); }, style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
          pagination={{ showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)) }}
        />
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={760}
        placement={locale === "ar" ? "left" : "right"}
        title={selected ? `${selected.user_name} · ${selected.amount_display}` : ""}
      >
        {selected && (
          <div className="flex flex-col gap-5 md:flex-row">
            {/* Side-by-side: receipt image */}
            <div className="md:w-1/2">
              {selected.image ? (
                <a href={selected.image} target="_blank" rel="noreferrer">
                  <img
                    src={selected.image}
                    alt="receipt"
                    className="max-h-[60vh] w-full rounded-lg border border-black/10 object-contain dark:border-white/10"
                  />
                </a>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-black/20 text-sm opacity-60 dark:border-white/20">
                  {dict.noImage}
                </div>
              )}
            </div>

            {/* Details + actions */}
            <div className="flex flex-col gap-3 md:w-1/2">
              <Tag color={STATUS_COLORS[selected.status]} className="w-fit">
                {tr("status", selected.status)}
              </Tag>
              <Field label={dict.colAmount} value={selected.amount_display} />
              <Field label={dict.phone} value={selected.user_phone} />
              <Field label={dict.colMethod} value={tr("method", selected.method)} />
              <Field label={dict.colPurpose} value={tr("purpose", selected.purpose)} />
              {selected.reference && <Field label={dict.reference} value={selected.reference} />}
              {selected.reviewed_by && <Field label={dict.reviewedBy} value={selected.reviewed_by} />}
              {selected.reject_reason && (
                <Text type="secondary">
                  {dict.rejectReason}: {selected.reject_reason}
                </Text>
              )}

              {selected.status === "PENDING" && (
                <div className="mt-2 flex flex-col gap-3">
                  <Input.TextArea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={dict.reasonPlaceholder}
                    rows={2}
                  />
                  <Space>
                    <Popconfirm title={dict.approve} onConfirm={() => act("approve")}>
                      <Button type="primary" loading={acting}>
                        {dict.approve}
                      </Button>
                    </Popconfirm>
                    <Button danger loading={acting} onClick={() => act("reject")}>
                      {dict.reject}
                    </Button>
                  </Space>
                </div>
              )}
            </div>
          </div>
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
