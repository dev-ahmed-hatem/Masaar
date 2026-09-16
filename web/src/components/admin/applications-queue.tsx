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
import { languageName } from "@/lib/languages";
import { DetailRow, FilterField, PageHeader, Panel } from "@/components/ui";
import StageCardSummary from "@/components/teaching/stage-card-summary";
import { CountryName } from "@/components/ui/country-select";
import {
  approveApplication,
  listApplications,
  rejectApplication,
  type ApplicationStatus,
  type TeacherApplication,
} from "@/lib/applications";

type Dict = Dictionary["adminApplications"];
type CardsDict = Dictionary["stageCards"];

const { Paragraph, Text } = Typography;

/** Placeholder for anything the applicant left empty, so gaps are explicit. */
function Missing({ dict }: { dict: Dict }) {
  return <Text type="secondary" italic>{dict.notProvided}</Text>;
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--ink-faint)", borderBottom: "1px solid var(--border)", paddingBottom: 4 }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function TextBlock({ dict, label, children }: { dict: Dict; label: string; children: React.ReactNode }) {
  return (
    <div>
      <Text strong>{label}</Text>
      <Paragraph style={{ marginTop: 4, marginBottom: 0, whiteSpace: "pre-wrap" }}>
        {children || <Missing dict={dict} />}
      </Paragraph>
    </div>
  );
}

function ChipBlock({ dict, label, items }: { dict: Dict; label: string; items: string[] }) {
  return (
    <div>
      <Text strong>{label}</Text>
      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items && items.length > 0 ? (
          items.map((item, i) => (
            <Tag key={i} style={{ marginInlineEnd: 0 }}>
              {item}
            </Tag>
          ))
        ) : (
          <Missing dict={dict} />
        )}
      </div>
    </div>
  );
}

function ResumeBlock({
  dict,
  label,
  rows,
}: {
  dict: Dict;
  label: string;
  rows: { head: string; sub: string; body: string }[];
}) {
  const filled = rows.filter((r) => r.head || r.sub || r.body);
  return (
    <div>
      <Text strong>{label}</Text>
      {filled.length === 0 && (
        <div style={{ marginTop: 4 }}>
          <Missing dict={dict} />
        </div>
      )}
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

export default function ApplicationsQueue({
  dict,
  cards,
  locale,
}: {
  dict: Dict;
  cards: CardsDict;
  locale: Locale;
}) {
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
    { title: dict.colMarket, key: "market", render: (_, a) => <CountryName code={a.market} locale={locale} /> },
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
        width={560}
        title={selected?.full_name ?? ""}
        placement={locale === "ar" ? "left" : "right"}
      >
        {selected && (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Tag color={STATUS_COLORS[selected.status]} className="w-fit">
              {statusLabel(selected.status)}
            </Tag>

            <DrawerSection title={dict.sectionBasics}>
              <div className="flex items-center gap-3">
                {selected.photo ? (
                  <a href={selected.photo} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selected.photo}
                      alt={selected.full_name}
                      style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }}
                    />
                  </a>
                ) : (
                  <DetailRow label={dict.photo} value={<Missing dict={dict} />} />
                )}
              </div>
              <DetailRow label={dict.fullName} value={selected.full_name || <Missing dict={dict} />} />
              <DetailRow label={dict.phone} value={<span dir="ltr">{selected.phone}</span>} />
              <DetailRow
                label={dict.email}
                value={selected.email ? <span dir="ltr">{selected.email}</span> : <Missing dict={dict} />}
              />
              <DetailRow label={dict.market} value={<CountryName code={selected.market} locale={locale} />} />
              <DetailRow
                label={dict.gender}
                value={
                  selected.gender ? (selected.gender === "MALE" ? dict.male : dict.female) : <Missing dict={dict} />
                }
              />
              <DetailRow
                label={dict.languages}
                value={
                  selected.languages.length > 0
                    ? selected.languages.map((code) => languageName(code, locale)).join(locale === "ar" ? "، " : ", ")
                    : <Missing dict={dict} />
                }
              />
              <DetailRow
                label={dict.submitted}
                value={new Date(selected.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
              />
            </DrawerSection>

            <DrawerSection title={dict.sectionAbout}>
              <TextBlock dict={dict} label={dict.bioEn}>{selected.bio}</TextBlock>
              <TextBlock dict={dict} label={dict.bioAr}>
                {selected.bio_ar ? <span dir="rtl">{selected.bio_ar}</span> : null}
              </TextBlock>
              <DetailRow
                label={dict.introVideo}
                value={
                  selected.intro_video_url ? (
                    <a href={selected.intro_video_url} target="_blank" rel="noreferrer" dir="ltr">
                      {selected.intro_video_url} ↗
                    </a>
                  ) : (
                    <Missing dict={dict} />
                  )
                }
              />
              <DetailRow
                label={dict.document}
                value={
                  selected.document ? (
                    <a href={selected.document} target="_blank" rel="noreferrer">
                      {dict.document} ↗
                    </a>
                  ) : (
                    <Missing dict={dict} />
                  )
                }
              />
              <ChipBlock dict={dict} label={dict.specialties} items={selected.specialties} />
            </DrawerSection>

            <DrawerSection title={dict.sectionTeaching}>
              {selected.stages_display.length === 0 ? (
                <Text type="secondary">{dict.noStages}</Text>
              ) : (
                selected.stages_display.map((card, i) =>
                  card.stage ? (
                    <StageCardSummary key={i} card={{ ...card, id: i }} dict={cards} locale={locale} />
                  ) : null,
                )
              )}
            </DrawerSection>

            <DrawerSection title={dict.sectionResume}>
              <ResumeBlock
                dict={dict}
                label={dict.education}
                rows={selected.education.map((e) => ({
                  head: [e.degree, e.institution].filter(Boolean).join(" — "),
                  sub: [e.start_year, e.end_year].filter(Boolean).join("–"),
                  body: e.description,
                }))}
              />
              <ResumeBlock
                dict={dict}
                label={dict.experience}
                rows={selected.work_experience.map((e) => ({
                  head: [e.title, e.organization].filter(Boolean).join(" — "),
                  sub: [e.start_year, e.end_year].filter(Boolean).join("–"),
                  body: e.description,
                }))}
              />
              <ResumeBlock
                dict={dict}
                label={dict.certifications}
                rows={selected.certifications.map((c) => ({
                  head: [c.name, c.issuer].filter(Boolean).join(" — "),
                  sub: c.year,
                  body: c.description,
                }))}
              />
            </DrawerSection>

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
