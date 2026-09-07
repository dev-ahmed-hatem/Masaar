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
import { marketLabel } from "@/lib/markets";
import { DetailRow, FilterField, PageHeader, Panel } from "@/components/ui";
import {
  approveApplication,
  listApplications,
  rejectApplication,
  type ApplicationStatus,
  type TeacherApplication,
} from "@/lib/applications";

type Dict = Dictionary["adminApplications"];

const { Paragraph, Text } = Typography;

function TextBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text strong>{label}</Text>
      <Paragraph style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{children}</Paragraph>
    </div>
  );
}

function ChipBlock({ label, items }: { label: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <Text strong>{label}</Text>
      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((item, i) => (
          <Tag key={i} style={{ marginInlineEnd: 0 }}>
            {item}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function ResumeBlock({
  label,
  rows,
}: {
  label: string;
  rows: { head: string; sub: string; body: string }[];
}) {
  const filled = rows.filter((r) => r.head || r.sub || r.body);
  if (filled.length === 0) return null;
  return (
    <div>
      <Text strong>{label}</Text>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
        {filled.map((r, i) => (
          <div key={i} style={{ borderInlineStart: "2px solid var(--border)", paddingInlineStart: 10 }}>
            {r.head && <div style={{ fontWeight: 600 }}>{r.head}</div>}
            {r.sub && <Text type="secondary">{r.sub}</Text>}
            {r.body && <Paragraph style={{ margin: 0 }}>{r.body}</Paragraph>}
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<TeacherApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TeacherApplication | null>(null);
  const [notes, setNotes] = useState("");
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listApplications(status || undefined, page)
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [status]);

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
    { title: dict.colMarket, key: "market", render: (_, a) => marketLabel(a.market, locale) },
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

  const filters = (
    <FilterField label={dict.filterStatus}>
      <Select
        value={status}
        onChange={setStatus}
        style={{ width: 220 }}
        options={[
          { value: "", label: dict.allStatuses },
          ...STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
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
          <Table<TeacherApplication>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            onRow={(a) => ({ onClick: () => openDetail(a), style: { cursor: "pointer" } })}
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
        width={460}
        title={selected?.full_name ?? ""}
        placement={locale === "ar" ? "left" : "right"}
      >
        {selected && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Tag color={STATUS_COLORS[selected.status]}>{statusLabel(selected.status)}</Tag>

            {selected.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.photo}
                alt={selected.full_name}
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }}
              />
            )}

            <DetailRow label={dict.colPhone} value={selected.phone} />
            <DetailRow label={dict.email} value={selected.email || "—"} />
            <DetailRow label={dict.colMarket} value={marketLabel(selected.market, locale)} />
            {selected.gender && (
              <DetailRow
                label={dict.gender}
                value={selected.gender === "MALE" ? dict.male : dict.female}
              />
            )}
            {selected.languages && (
              <DetailRow label={dict.languages} value={selected.languages} />
            )}
            <DetailRow label={dict.freeLessons} value={String(selected.free_lessons_offered)} />

            {selected.bio && (
              <TextBlock label={dict.bioEn}>{selected.bio}</TextBlock>
            )}
            {selected.bio_ar && (
              <TextBlock label={dict.bioAr}>
                <span dir="rtl">{selected.bio_ar}</span>
              </TextBlock>
            )}

            {selected.intro_video_url && (
              <a href={selected.intro_video_url} target="_blank" rel="noreferrer">
                {dict.introVideo} ↗
              </a>
            )}

            {selected.document && (
              <a href={selected.document} target="_blank" rel="noreferrer">
                {dict.document} ↗
              </a>
            )}

            <ChipBlock label={dict.specialties} items={selected.specialties} />
            <ChipBlock label={dict.subjects} items={selected.subjects_display} />
            <ChipBlock label={dict.specializations} items={selected.specializations_display} />
            <ChipBlock label={dict.availability} items={selected.availability_display} />

            <ResumeBlock
              label={dict.education}
              rows={selected.education.map((e) => ({
                head: [e.degree, e.institution].filter(Boolean).join(" — "),
                sub: [e.start_year, e.end_year].filter(Boolean).join("–"),
                body: e.description,
              }))}
            />
            <ResumeBlock
              label={dict.experience}
              rows={selected.work_experience.map((e) => ({
                head: [e.title, e.organization].filter(Boolean).join(" — "),
                sub: [e.start_year, e.end_year].filter(Boolean).join("–"),
                body: e.description,
              }))}
            />
            <ResumeBlock
              label={dict.certifications}
              rows={selected.certifications.map((c) => ({
                head: [c.name, c.issuer].filter(Boolean).join(" — "),
                sub: c.year,
                body: c.description,
              }))}
            />

            {selected.reviewed_by && (
              <DetailRow label={dict.reviewedBy} value={selected.reviewed_by} />
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
                  <Popconfirm title={dict.reject} onConfirm={() => act("reject")}>
                    <Button danger loading={acting} disabled={!notes.trim()}>
                      {dict.reject}
                    </Button>
                  </Popconfirm>
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
