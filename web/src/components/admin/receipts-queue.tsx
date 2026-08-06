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
import { DetailRow, FilterField, PageHeader, Panel } from "@/components/ui";
import { approveReceipt, listReceipts, rejectReceipt, type Receipt, type ReceiptStatus } from "@/lib/receipts";

type Dict = Dictionary["adminReceipts"];

const { Text } = Typography;

const STATUS_COLORS: Record<ReceiptStatus, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
};

const STATUSES: ReceiptStatus[] = ["PENDING", "APPROVED", "REJECTED"];

export default function ReceiptsQueue({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<string>("PENDING");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
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
    listReceipts(status || undefined, page, 20)
      .then((data) => {
        setRows(data.results);
        setTotal(data.count);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [status, page, dict.loadError]);

  useEffect(() => load(), [load]);

  useEffect(() => setPage(1), [status]);

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

  const filters = (
    <FilterField label={dict.filterStatus}>
      <Select
        value={status}
        onChange={setStatus}
        style={{ width: 220 }}
        options={[
          { value: "", label: dict.allStatuses },
          ...STATUSES.map((s) => ({ value: s, label: tr("status", s) })),
        ]}
      />
    </FilterField>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Panel toolbar={filters}>
          <Table<Receipt>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            onRow={(r) => ({ onClick: () => { setSelected(r); setReason(""); }, style: { cursor: "pointer" } })}
            locale={{ emptyText: <Empty description={dict.empty} /> }}
            pagination={{
              current: page,
              pageSize: 20,
              total,
              showSizeChanger: false,
              onChange: setPage,
              showTotal: () => dict.resultsCount.replace("{count}", String(total)),
            }}
          />
        </Panel>
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
              <DetailRow label={dict.colAmount} value={selected.amount_display} />
              <DetailRow label={dict.phone} value={selected.user_phone} />
              <DetailRow label={dict.colMethod} value={tr("method", selected.method)} />
              <DetailRow label={dict.colPurpose} value={tr("purpose", selected.purpose)} />
              {selected.reference && <DetailRow label={dict.reference} value={selected.reference} />}
              {selected.reviewed_by && <DetailRow label={dict.reviewedBy} value={selected.reviewed_by} />}
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
                    <Popconfirm title={dict.reject} onConfirm={() => act("reject")}>
                      <Button danger loading={acting} disabled={!reason.trim()}>
                        {dict.reject}
                      </Button>
                    </Popconfirm>
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
