"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Drawer,
  Empty,
  Rate,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import {
  getTeacher,
  listSubjects,
  listTeachers,
  type SubjectSummary,
  type TeacherDetail,
  type TeacherListItem,
} from "@/lib/teachers";

type Dict = Dictionary["adminTeachers"];

const { Title, Paragraph, Text } = Typography;
const PAGE_SIZE = 20;

const MARKETS = ["EG", "SA"] as const;

function marketLabel(code: string, locale: Locale): string {
  if (code === "EG") return locale === "ar" ? "مصر" : "Egypt";
  if (code === "SA") return locale === "ar" ? "السعودية" : "Saudi Arabia";
  return code;
}

export default function TeacherBrowser({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ar = locale === "ar";
  const subjectName = useCallback(
    (s: SubjectSummary) => (ar ? s.name_ar : s.name_en),
    [ar],
  );

  const [market, setMarket] = useState<string>("EG");
  const [subject, setSubject] = useState<number | undefined>();
  const [gender, setGender] = useState<string | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [ordering, setOrdering] = useState<string>("-rating_avg");
  const [page, setPage] = useState(1);

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [rows, setRows] = useState<TeacherListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TeacherDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTeachers({ market, subject, gender, min_rating: minRating, ordering, page, page_size: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setRows(data.results);
        setTotal(data.count);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : dict.loadError);
        setRows([]);
        setTotal(0);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [market, subject, gender, minRating, ordering, page, dict.loadError]);

  // Reset to first page whenever a filter (not the page itself) changes.
  useEffect(() => setPage(1), [market, subject, gender, minRating, ordering]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setSelected(null);
    try {
      setSelected(await getTeacher(id));
    } finally {
      setDetailLoading(false);
    }
  }

  const columns: ColumnsType<TeacherListItem> = [
    { title: dict.colName, dataIndex: "full_name", key: "name" },
    {
      title: dict.colSubjects,
      key: "subjects",
      render: (_, t) => (
        <Space size={[0, 4]} wrap>
          {t.subjects.map((s) => (
            <Tag key={s.id}>{subjectName(s)}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: dict.colFrom,
      key: "from",
      render: (_, t) => t.from_price?.display ?? "—",
    },
    {
      title: dict.colRating,
      key: "rating",
      render: (_, t) => (
        <Space size={4}>
          <Rate disabled allowHalf value={Number(t.rating_avg)} style={{ fontSize: 14 }} />
          <Text type="secondary">({t.rating_count})</Text>
        </Space>
      ),
    },
    { title: dict.colLessons, dataIndex: "lessons_count", key: "lessons" },
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

      <Space wrap size="middle">
        <Labeled label={dict.market}>
          <Select
            value={market}
            onChange={setMarket}
            style={{ width: 160 }}
            options={MARKETS.map((c) => ({ value: c, label: marketLabel(c, locale) }))}
          />
        </Labeled>
        <Labeled label={dict.subject}>
          <Select
            allowClear
            placeholder={dict.allSubjects}
            value={subject}
            onChange={(v) => setSubject(v)}
            style={{ width: 200 }}
            options={subjects.map((s) => ({ value: s.id, label: subjectName(s) }))}
          />
        </Labeled>
        <Labeled label={dict.gender}>
          <Select
            allowClear
            placeholder={dict.anyGender}
            value={gender}
            onChange={(v) => setGender(v)}
            style={{ width: 140 }}
            options={[
              { value: "MALE", label: dict.male },
              { value: "FEMALE", label: dict.female },
            ]}
          />
        </Labeled>
        <Labeled label={dict.minRating}>
          <Select
            allowClear
            placeholder="—"
            value={minRating}
            onChange={(v) => setMinRating(v)}
            style={{ width: 110 }}
            options={[3, 3.5, 4, 4.5].map((r) => ({ value: r, label: `${r}★+` }))}
          />
        </Labeled>
        <Labeled label={dict.sortBy}>
          <Select
            value={ordering}
            onChange={setOrdering}
            style={{ width: 180 }}
            options={[
              { value: "-rating_avg", label: dict.sortRating },
              { value: "from_price_minor", label: dict.sortPriceAsc },
              { value: "-lessons_count", label: dict.sortLessons },
            ]}
          />
        </Labeled>
      </Space>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Table<TeacherListItem>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          onRow={(t) => ({ onClick: () => openDetail(t.id), style: { cursor: "pointer" } })}
          locale={{ emptyText: <Empty description={dict.empty} /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: () => dict.resultsCount.replace("{count}", String(total)),
          }}
        />
      )}

      <Drawer
        open={detailLoading || selected !== null}
        onClose={() => setSelected(null)}
        width={480}
        title={selected?.full_name ?? ""}
        placement={ar ? "left" : "right"}
      >
        {detailLoading || !selected ? (
          <div className="flex justify-center py-16">
            <Spin />
          </div>
        ) : (
          <TeacherDetailView dict={dict} locale={locale} teacher={selected} />
        )}
      </Drawer>
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="opacity-60">{label}</span>
      {children}
    </label>
  );
}

function TeacherDetailView({
  dict,
  locale,
  teacher,
}: {
  dict: Dict;
  locale: Locale;
  teacher: TeacherDetail;
}) {
  const ar = locale === "ar";
  const bio = (ar ? teacher.bio_ar : teacher.bio_en) || teacher.bio_en || teacher.bio_ar;

  const offerColumns: ColumnsType<TeacherDetail["offerings"][number]> = [
    {
      title: dict.colCategory,
      key: "cat",
      render: (_, o) =>
        [o.vertical, o.grade_level, o.subject].filter(Boolean).join(" · "),
    },
    {
      title: dict.colPrice,
      key: "price",
      render: (_, o) => (
        <Space size={4}>
          <span>{o.price.display}</span>
          {o.is_custom_price && <Tag color="blue">{dict.custom}</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Space size={4} wrap>
        <Rate disabled allowHalf value={Number(teacher.rating_avg)} style={{ fontSize: 16 }} />
        <Text type="secondary">
          {Number(teacher.rating_avg).toFixed(1)} · {teacher.rating_count} · {teacher.lessons_count}{" "}
          {dict.colLessons.toLowerCase()}
        </Text>
      </Space>

      {teacher.free_lessons_offered > 0 && (
        <Tag color="green">
          {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
        </Tag>
      )}

      {bio && (
        <div>
          <Text strong>{dict.bio}</Text>
          <Paragraph style={{ marginTop: 4 }}>{bio}</Paragraph>
        </div>
      )}

      {teacher.intro_video_url && (
        <a href={teacher.intro_video_url} target="_blank" rel="noreferrer">
          {dict.introVideo} ↗
        </a>
      )}

      <div>
        <Text strong>{dict.offerings}</Text>
        <Table
          rowKey="lesson_category_id"
          size="small"
          columns={offerColumns}
          dataSource={teacher.offerings}
          pagination={false}
          style={{ marginTop: 8 }}
        />
      </div>

      {teacher.availability.length > 0 && (
        <div>
          <Text strong>{dict.availability}</Text>
          <div style={{ marginTop: 8 }}>
            <Space size={[4, 4]} wrap>
              {teacher.availability.map((a, i) => (
                <Tag key={i}>
                  {dict.weekdays[a.weekday]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      )}

      <div>
        <Text strong>
          {dict.reviews} ({teacher.reviews_summary.rating_count})
        </Text>
        {teacher.recent_reviews.length === 0 ? (
          <Paragraph type="secondary" style={{ marginTop: 4 }}>
            {dict.noReviews}
          </Paragraph>
        ) : (
          <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
            {teacher.recent_reviews.map((r, i) => (
              <div key={i} className="rounded-lg border border-black/10 p-3 dark:border-white/10">
                <Space size={4}>
                  <Rate disabled value={r.rating} style={{ fontSize: 12 }} />
                  <Text type="secondary">{r.student_name}</Text>
                </Space>
                {r.text && <Paragraph style={{ marginBottom: 0 }}>{r.text}</Paragraph>}
              </div>
            ))}
          </Space>
        )}
      </div>
    </Space>
  );
}
