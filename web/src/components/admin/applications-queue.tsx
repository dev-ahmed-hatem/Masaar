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
import {
  approveApplication,
  listApplications,
  rejectApplication,
  type ApplicationStatus,
  type TeacherApplication,
} from "@/lib/applications";

type Dict = Dictionary["adminApplications"];

const { Title, Paragraph, Text } = Typography;

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  PENDING: "gold",
  CHANGES_REQUESTED: "blue",
  APPROVED: "green",
  REJECTED: "red",
};

const STATUSES: ApplicationStatus[] = [
  "PENDING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
];

export default function ApplicationsQueue({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const statusLabel = useCallback(
    (s: ApplicationStatus) => dict[`status${s}` as keyof Dict] as string,
    [dict],
  );

  const [status, setStatus] = useState<string>("PENDING");
  const [rows, setRows] = useState<TeacherApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TeacherApplication | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listApplications(status || undefined)
      .then((data) => setRows(data.results))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
      })
      .finally(() => setLoading(false));
  }, [status, dict.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  function openDetail(app: TeacherApplication) {
    setSelected(app);
    setNotes(app.review_notes ?? "");
  }

  async function act(kind: "approve" | "reject") {
    if (!selected) return;
    setActing(true);
    try {
      if (kind === "approve") {
        await approveApplication(selected.id);
        message.success(dict.approved);
      } else {
        await rejectApplication(selected.id, notes);
        message.success(dict.rejected);
      }
      setSelected(null);
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setActing(false);
    }
  }

  const columns: ColumnsType<TeacherApplication> = [
    { title: dict.colName, dataIndex: "full_name", key: "name" },
    { title: dict.colPhone, dataIndex: "phone", key: "phone" },
    { title: dict.colMarket, dataIndex: "market", key: "market" },
    {
      title: dict.colStatus,
      key: "status",
      render: (_, a) => <Tag color={STATUS_COLORS[a.status]}>{statusLabel(a.status)}</Tag>,
    },
    {
      title: dict.colSubmitted,
      key: "submitted",
      render: (_, a) => new Date(a.created_at).toLocaleDateString(locale),
    },
  ];

  const isPending =
    selected?.status === "PENDING" || selected?.status === "CHANGES_REQUESTED";

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

      <Space>
        <label className="flex flex-col gap-1 text-xs">
          <span className="opacity-60">{dict.filterStatus}</span>
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 200 }}
            options={[
              { value: "", label: dict.allStatuses },
              ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
            ]}
          />
        </label>
      </Space>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Table<TeacherApplication>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          onRow={(a) => ({ onClick: () => openDetail(a), style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
          pagination={{
            showTotal: () => dict.resultsCount.replace("{count}", String(rows.length)),
          }}
        />
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        width={460}
        title={selected?.full_name ?? ""}
        placement={locale === "ar" ? "left" : "right"}
      >
        {selected && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Tag color={STATUS_COLORS[selected.status]}>{statusLabel(selected.status)}</Tag>

            <Field label={dict.colPhone} value={selected.phone} />
            <Field label={dict.email} value={selected.email || "—"} />
            <Field label={dict.colMarket} value={selected.market} />

            {selected.bio && (
              <div>
                <Text strong>{dict.bio}</Text>
                <Paragraph style={{ marginTop: 4 }}>{selected.bio}</Paragraph>
              </div>
            )}

            {selected.intro_video_url && (
              <a href={selected.intro_video_url} target="_blank" rel="noreferrer">
                {dict.introVideo} ↗
              </a>
            )}

            {selected.reviewed_by && (
              <Field label={dict.reviewedBy} value={selected.reviewed_by} />
            )}

            {isPending ? (
              <>
                <div>
                  <Text strong>{dict.reviewNotes}</Text>
                  <Input.TextArea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={dict.notesPlaceholder}
                    rows={3}
                    style={{ marginTop: 4 }}
                  />
                </div>
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
              </>
            ) : (
              selected.review_notes && (
                <div>
                  <Text strong>{dict.reviewNotes}</Text>
                  <Paragraph style={{ marginTop: 4 }}>{selected.review_notes}</Paragraph>
                </div>
              )
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
