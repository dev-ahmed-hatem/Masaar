"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Avatar, Drawer, Empty, Pagination, Select, Spin, Tag } from "antd";
import { ArrowRight, GraduationCap, Languages, Search, SlidersHorizontal, Star } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import {
  listSubjects,
  listTeachers,
  type SubjectSummary,
  type TeacherListItem,
} from "@/lib/teachers";
import {
  catalog,
  catalogName,
  type Stage,
  type StageSubject,
  type Track as CatalogTrack,
} from "@/lib/catalog";
import { FilterField } from "@/components/ui";

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
  const [stage, setStage] = useState<number | undefined>();
  const [track, setTrack] = useState<number | undefined>();
  const [subject, setSubject] = useState<number | undefined>();
  const [gender, setGender] = useState<string | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [ordering, setOrdering] = useState<string>("-rating_avg");
  const [page, setPage] = useState(1);

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [scopedSubjects, setScopedSubjects] = useState<StageSubject[]>([]);
  const [rows, setRows] = useState<TeacherListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeStage = stages.find((s) => s.id === stage);
  const needsTrack = activeStage != null && activeStage.child_kind !== "NONE";

  useEffect(() => {
    if (lockedMarket) setMarket(lockedMarket);
  }, [lockedMarket]);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setSubjects([]));
    catalog.listStages().then(setStages).catch(() => setStages([]));
  }, []);

  // Cascade: stage → tracks (if grouped) or scoped subjects; reset children.
  useEffect(() => {
    setTrack(undefined);
    setSubject(undefined);
    setTracks([]);
    setScopedSubjects([]);
    if (!stage) return;
    if (needsTrack) catalog.listTracks(stage).then(setTracks).catch(() => {});
    else catalog.listStageSubjects(stage).then(setScopedSubjects).catch(() => {});
  }, [stage, needsTrack]);

  useEffect(() => {
    setSubject(undefined);
    if (stage && needsTrack && track) {
      catalog.listStageSubjects(stage, track).then(setScopedSubjects).catch(() => {});
    }
  }, [track, stage, needsTrack]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTeachers({ market, stage, track, subject, gender, min_rating: minRating, ordering, page, page_size: PAGE_SIZE })
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
  }, [market, stage, track, subject, gender, minRating, ordering, page, dict.loadError]);

  useEffect(() => setPage(1), [market, stage, track, subject, gender, minRating, ordering]);

  // Subject options: scoped to the chosen stage/track when set, else the full list.
  const subjectOptions = stage
    ? scopedSubjects.map((ss) => ({
        value: ss.subject,
        label: ar ? ss.subject_name_ar : ss.subject_name_en,
      }))
    : subjects.map((s) => ({ value: s.id, label: subjectName(s) }));

  const advancedCount =
    (gender ? 1 : 0) + (minRating != null ? 1 : 0) + (ordering !== "-rating_avg" ? 1 : 0);
  const anyFilter = stage != null || track != null || subject != null || advancedCount > 0;

  function clearAll() {
    setStage(undefined);
    setTrack(undefined);
    setSubject(undefined);
    setGender(undefined);
    setMinRating(undefined);
    setOrdering("-rating_avg");
  }

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {dict.title}
      </h1>

      {/* Search-first row: subject search + advanced-filters trigger */}
      <div className="flex items-center gap-2">
        <Select
          showSearch
          allowClear
          size="large"
          optionFilterProp="label"
          value={subject}
          onChange={(v) => setSubject(v)}
          placeholder={dict.searchPlaceholder}
          suffixIcon={<Search size={18} style={{ color: "var(--ink-faint)" }} />}
          options={subjectOptions}
          className="flex-1"
          style={{ minWidth: 0 }}
        />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="icon-btn h-10 shrink-0 px-3.5 text-sm font-semibold sm:px-4"
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">{dict.filters}</span>
          {advancedCount > 0 && (
            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-bold" style={{ background: "var(--brand)", color: "#fff" }}>
              {advancedCount}
            </span>
          )}
        </button>
      </div>

      {/* Stage chips */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Chip active={stage == null} onClick={() => setStage(undefined)}>{dict.allStages}</Chip>
        {stages.map((s) => (
          <Chip key={s.id} active={stage === s.id} onClick={() => setStage(s.id)}>{catalogName(s, locale)}</Chip>
        ))}
      </div>

      {/* Branch / faculty chips */}
      {needsTrack && tracks.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Chip active={track == null} onClick={() => setTrack(undefined)}>
            {activeStage?.child_kind === "FACULTY" ? dict.allFaculties : dict.allBranches}
          </Chip>
          {tracks.map((t) => (
            <Chip key={t.id} active={track === t.id} onClick={() => setTrack(t.id)}>{catalogName(t, locale)}</Chip>
          ))}
        </div>
      )}

      {/* Results header */}
      {!loading && !error && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {dict.resultsCount.replace("{count}", String(total))}
          </span>
          {anyFilter && (
            <button type="button" onClick={clearAll} className="link-brand text-sm font-semibold">
              {dict.clearFilters}
            </button>
          )}
        </div>
      )}

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
          <div className="flex flex-col gap-4">
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

      {/* Advanced filters — mobile bottom sheet */}
      <Drawer
        title={dict.filters}
        placement="bottom"
        height="auto"
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
      >
        <div className="mx-auto flex max-w-md flex-col gap-4 pb-2">
          <FilterField label={dict.gender}>
            <Select
              allowClear
              placeholder={dict.anyGender}
              value={gender}
              onChange={(v) => setGender(v)}
              style={{ width: "100%" }}
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
              style={{ width: "100%" }}
              options={[3, 3.5, 4, 4.5].map((r) => ({ value: r, label: `${r}★+` }))}
            />
          </FilterField>
          <FilterField label={dict.sortBy}>
            <Select
              value={ordering}
              onChange={setOrdering}
              style={{ width: "100%" }}
              options={[
                { value: "-rating_avg", label: dict.sortRating },
                { value: "from_price_minor", label: dict.sortPriceAsc },
                { value: "-lessons_count", label: dict.sortLessons },
              ]}
            />
          </FilterField>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={clearAll} className="btn btn-ghost flex-1">{dict.clearFilters}</button>
            <button type="button" onClick={() => setFiltersOpen(false)} className="btn btn-primary flex-1">{dict.showResults}</button>
          </div>
        </div>
      </Drawer>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`chip shrink-0 px-3.5 py-1.5 text-sm font-semibold${active ? " is-active" : ""}`}
    >
      {children}
    </button>
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
  const ar = locale === "ar";
  const rating = Number(t.rating_avg);
  const bio = (ar ? t.bio_ar : t.bio_en) || t.bio_en || t.bio_ar || "";
  const langs = t.languages.filter(Boolean);

  // Brief chips: unique specialization subjects, falling back to plain subjects.
  const specById = new Map<number, string>();
  for (const sp of t.specializations ?? []) {
    specById.set(sp.subject.id, ar ? sp.subject.name_ar : sp.subject.name_en);
  }
  const specChips = specById.size
    ? [...specById].map(([id, label]) => ({ id, label }))
    : t.subjects.map((s) => ({ id: s.id, label: subjectName(s) }));

  return (
    <Link
      href={`/${locale}/teachers/${t.id}`}
      className="surface surface-hover group flex gap-4 p-4 sm:gap-5 sm:p-5"
    >
      {/* Photo */}
      <Avatar
        shape="square"
        src={t.photo_url ?? undefined}
        className="h-20 w-20 shrink-0 sm:h-28 sm:w-28"
        style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700, fontSize: 30, borderRadius: 16 }}
      >
        {(t.full_name || "?").trim().charAt(0).toUpperCase()}
      </Avatar>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Name + price */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="truncate text-base font-bold sm:text-lg"
              style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
            >
              {t.full_name}
            </h3>
            {langs.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: "var(--ink-muted)" }}>
                <Languages size={13} className="shrink-0" />
                <span className="truncate">{langs.join(" · ")}</span>
              </p>
            )}
          </div>
          {t.from_price && (
            <div className="shrink-0 text-end">
              <div className="text-lg font-bold leading-tight" style={{ color: "var(--ink)" }}>
                {t.from_price.display}
              </div>
              <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                {dict.perLesson}
              </div>
            </div>
          )}
        </div>

        {/* Rating + lessons */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--ink)" }}>
            <Star size={15} fill="var(--warning)" stroke="var(--warning)" />
            {rating > 0 ? rating.toFixed(1) : "—"}
          </span>
          {t.rating_count > 0 && (
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              {dict.reviewsCount.replace("{n}", String(t.rating_count))}
            </span>
          )}
          <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>
          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            <GraduationCap size={14} />
            {t.lessons_count} {dict.lessons}
          </span>
        </div>

        {/* Specialization chips (brief): unique subjects, falling back to subjects */}
        {specChips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {specChips.slice(0, 4).map((c) => (
              <Tag key={c.id} bordered={false} style={{ background: "var(--surface-2)", margin: 0 }}>
                {c.label}
              </Tag>
            ))}
            {specChips.length > 4 && (
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                +{specChips.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {bio && (
          <p className="line-clamp-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            {bio}
          </p>
        )}

        {/* Footer: free-trial badge + view CTA */}
        <div className="mt-1 flex items-center justify-between gap-3">
          {t.free_lessons_offered > 0 ? (
            <Tag color="green" bordered={false} style={{ margin: 0 }}>
              {dict.freeLessons.replace("{n}", String(t.free_lessons_offered))}
            </Tag>
          ) : (
            <span />
          )}
          <span
            className="flex items-center gap-1 text-sm font-semibold transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            style={{ color: "var(--brand)" }}
          >
            {dict.viewProfile}
            <ArrowRight size={15} className="rtl:-scale-x-100" />
          </span>
        </div>
      </div>
    </Link>
  );
}
