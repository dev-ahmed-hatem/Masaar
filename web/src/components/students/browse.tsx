"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Avatar, Empty, Pagination, Rate, Select, Spin, Tag } from "antd";
import { GraduationCap } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { MARKETS, marketLabel } from "@/lib/markets";
import {
  listSubjects,
  listTeachers,
  type SubjectSummary,
  type TeacherListItem,
} from "@/lib/teachers";
import { FilterField, PageHeader } from "@/components/ui";

type Dict = Dictionary["browse"];

const PAGE_SIZE = 12;

export default function StudentBrowse({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ar = locale === "ar";
  const { user } = useAuth();
  const subjectName = useCallback(
    (s: SubjectSummary) => (ar ? s.name_ar : s.name_en),
    [ar],
  );

  // Signed-in users are locked to their own market (they can only book there);
  // anonymous visitors can browse either market.
  const lockedMarket = user?.market ?? null;
  const [market, setMarket] = useState<string>(lockedMarket ?? "EG");
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

  useEffect(() => {
    if (lockedMarket) setMarket(lockedMarket);
  }, [lockedMarket]);

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

  useEffect(() => setPage(1), [market, subject, gender, minRating, ordering]);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      <div className="flex flex-wrap items-end gap-4">
        {!lockedMarket && (
          <FilterField label={dict.market}>
            <Select
              value={market}
              onChange={setMarket}
              style={{ width: 160 }}
              options={MARKETS.map((m) => ({ value: m.code, label: `${m.flag} ${marketLabel(m.code, locale)}` }))}
            />
          </FilterField>
        )}
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
            style={{ width: 170 }}
            options={[
              { value: "-rating_avg", label: dict.sortRating },
              { value: "from_price_minor", label: dict.sortPriceAsc },
              { value: "-lessons_count", label: dict.sortLessons },
            ]}
          />
        </FilterField>
      </div>

      {error ? (
        <Alert type="error" message={error} showIcon />
      ) : loading ? (
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <Empty description={dict.empty} className="py-16" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => (
              <TeacherCard key={t.id} teacher={t} locale={locale} dict={dict} subjectName={subjectName} />
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-center pt-2">
              <Pagination
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TeacherCard({
  teacher: t,
  locale,
  dict,
  subjectName,
}: {
  teacher: TeacherListItem;
  locale: Locale;
  dict: Dict;
  subjectName: (s: SubjectSummary) => string;
}) {
  return (
    <Link
      href={`/${locale}/teachers/${t.id}`}
      className="surface surface-hover flex flex-col gap-4 p-5"
    >
      <div className="flex items-center gap-3">
        <Avatar
          size={52}
          src={t.photo_url ?? undefined}
          style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700 }}
        >
          {(t.full_name || "?").trim().charAt(0).toUpperCase()}
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold" style={{ color: "var(--ink)" }}>
            {t.full_name}
          </div>
          <div className="flex items-center gap-1.5">
            <Rate disabled allowHalf value={Number(t.rating_avg)} style={{ fontSize: 12 }} />
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {Number(t.rating_avg).toFixed(1)} ({t.rating_count})
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {t.subjects.slice(0, 4).map((s) => (
          <Tag key={s.id} bordered={false} style={{ background: "var(--surface-2)" }}>
            {subjectName(s)}
          </Tag>
        ))}
      </div>

      {t.free_lessons_offered > 0 && (
        <Tag color="green" bordered={false} style={{ width: "fit-content" }}>
          {dict.freeLessons.replace("{n}", String(t.free_lessons_offered))}
        </Tag>
      )}

      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
          <GraduationCap size={14} />
          {t.lessons_count} {dict.lessons}
        </span>
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          {t.from_price ? `${dict.from} ${t.from_price.display}` : ""}
        </span>
      </div>
    </Link>
  );
}
