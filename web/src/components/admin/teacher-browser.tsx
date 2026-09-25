"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Drawer,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Users } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { FilterField, PageHeader, Panel } from "@/components/ui";
import CountrySelect from "@/components/admin/country-select";
import {
  getTeacher,
  listSubjects,
  listTeachers,
  type SubjectSummary,
  type TeacherDetail,
  type TeacherListItem,
} from "@/lib/teachers";

import StageCardSummary from "@/components/teaching/stage-card-summary";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";

type Dict = Dictionary["adminTeachers"];
type CardsDict = Dictionary["stageCards"];

const { Paragraph, Text } = Typography;
const PAGE_SIZE = 20;

export default function TeacherBrowser({
  dict,
  cards,
  locale,
}: {
  dict: Dict;
  cards: CardsDict;
  locale: Locale;
}) {
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
    {
      title: dict.colName,
      key: "name",
      render: (_, t) => (
        <Space>
          <Avatar size="xs" src={t.photo_url} name={t.full_name} />
          {t.full_name}
        </Space>
      ),
    },
    {
      title: dict.colSubjects,
      key: "subjects",
      render: (_, t) => (
        <Space size={[0, 4]} wrap>
          {t.subjects.map((s) => (
            <Badge key={s.id} size="sm">{subjectName(s)}</Badge>
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
      render: (_, t) => <Rating value={Number(t.rating_avg)} count={t.rating_count} size="sm" />,
    },
    { title: dict.colLessons, dataIndex: "lessons_count", key: "lessons" },
  ];

  const filters = (
    <>
      <FilterField label={dict.market}>
        <CountrySelect locale={locale} value={market} onChange={setMarket} style={{ width: 240 }} />
      </FilterField>
      <FilterField label={dict.subject}>
        <Select
          allowClear
          placeholder={dict.allSubjects}
          value={subject}
          onChange={(v) => setSubject(v)}
          style={{ width: 200 }}
          options={subjects.map((s) => ({ value: s.id, label: subjectName(s) }))}
        />
      </FilterField>
      <FilterField label={dict.gender}>
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
      </FilterField>
      <FilterField label={dict.minRating}>
        <Select
          allowClear
          placeholder="—"
          value={minRating}
          onChange={(v) => setMinRating(v)}
          style={{ width: 110 }}
          options={[3, 3.5, 4, 4.5].map((r) => ({ value: r, label: `${r}★+` }))}
        />
      </FilterField>
      <FilterField label={dict.sortBy}>
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
      </FilterField>
    </>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : (
        <Panel toolbar={filters}>
          <Table<TeacherListItem>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            loading={loading}
            onRow={(t) => ({ onClick: () => openDetail(t.id), style: { cursor: "pointer" } })}
            locale={{ emptyText: <EmptyState icon={<Users aria-hidden />} title={dict.empty} className="py-10" /> }}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total,
              showSizeChanger: false,
              onChange: setPage,
              showTotal: () => dict.resultsCount.replace("{count}", String(total)),
            }}
          />
        </Panel>
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
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        ) : (
          <TeacherDetailView dict={dict} cards={cards} locale={locale} teacher={selected} />
        )}
      </Drawer>
    </section>
  );
}

function TeacherDetailView({
  dict,
  cards,
  locale,
  teacher,
}: {
  dict: Dict;
  cards: CardsDict;
  locale: Locale;
  teacher: TeacherDetail;
}) {
  const ar = locale === "ar";
  const bio = (ar ? teacher.bio_ar : teacher.bio_en) || teacher.bio_en || teacher.bio_ar;

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Space size={8} wrap>
        <Rating value={Number(teacher.rating_avg)} count={teacher.rating_count} />
        <Text type="secondary">
          {teacher.lessons_count} {dict.colLessons.toLowerCase()}
        </Text>
      </Space>

      {teacher.free_lessons_offered > 0 && (
        <Badge variant="success" className="w-fit">
          {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
        </Badge>
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
        <Text strong>{dict.stages}</Text>
        <div className="mt-2 flex flex-col gap-2">
          {teacher.stages.length === 0 ? (
            <Text type="secondary">{cards.empty}</Text>
          ) : (
            teacher.stages.map((card) => (
              <StageCardSummary key={card.id} card={card} dict={cards} locale={locale} />
            ))
          )}
        </div>
      </div>

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
              <div key={i} className="rounded-card border border-border p-3">
                <Space size={4}>
                  <Rating value={r.rating} display="stars" size="sm" showValue={false} />
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
