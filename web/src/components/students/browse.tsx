"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Languages,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { guessMarket } from "@/lib/markets";
import {
  languageName,
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
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Rating } from "@/components/ui/rating";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

type Dict = Dictionary["browse"];

const PAGE_SIZE = 12;

/** Radix Select has no empty value, so "any" needs a sentinel. */
const ANY = "__any";

export default function StudentBrowse({
  dict,
  locale,
  initialStage,
  initialSubject,
}: {
  dict: Dict;
  locale: Locale;
  /** Pre-applied filters, deep-linked from the landing hero search. */
  initialStage?: number;
  initialSubject?: number;
}) {
  const ar = locale === "ar";
  const { user } = useAuth();
  const subjectName = useCallback(
    (s: SubjectSummary) => (ar ? s.name_ar : s.name_en),
    [ar],
  );

  // Signed-in users are locked to their own market (they can only book there);
  // anonymous visitors browse the market we guess for them.
  const lockedMarket = user?.market ?? null;
  const [market, setMarket] = useState<string>(lockedMarket ?? "EG");
  const [name, setName] = useState("");
  const [nameQuery, setNameQuery] = useState(""); // debounced value sent to the API
  const [stage, setStage] = useState<number | undefined>(initialStage);
  const [track, setTrack] = useState<number | undefined>();
  const [subject, setSubject] = useState<number | undefined>(initialSubject);
  const [gender, setGender] = useState<string | undefined>();
  const [language, setLanguage] = useState<string | undefined>();
  const [weekday, setWeekday] = useState<number | undefined>();
  const [minRating, setMinRating] = useState<number | undefined>();
  const [ordering, setOrdering] = useState<string>("-rating_avg");
  const [page, setPage] = useState(1);

  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [scopedSubjects, setScopedSubjects] = useState<StageSubject[]>([]);
  const [rows, setRows] = useState<TeacherListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reloads, setReloads] = useState(0);

  const activeStage = stages.find((s) => s.id === stage);
  const needsTrack = activeStage != null && activeStage.child_kind !== "NONE";

  // `guessMarket` reads localStorage and the device timezone, so it can only
  // run after mount — on the server it always answers EG.
  useEffect(() => {
    setMarket(lockedMarket ?? guessMarket());
  }, [lockedMarket]);

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => setSubjects([]));
    catalog.listStages().then(setStages).catch(() => setStages([]));
  }, []);

  // Clear the child filters only when the parent actually CHANGES, not on every
  // run of these effects. Two reasons: a deep-linked ?subject= must survive the
  // first run, and `needsTrack` flips once the stage list arrives, which would
  // otherwise re-trigger a reset a moment after mount.
  const prevStage = useRef(stage);
  const prevTrack = useRef(track);

  // Cascade: stage → tracks (if grouped) or scoped subjects.
  useEffect(() => {
    if (prevStage.current !== stage) {
      prevStage.current = stage;
      setTrack(undefined);
      setSubject(undefined);
    }
    setTracks([]);
    setScopedSubjects([]);
    if (!stage) return;
    if (needsTrack) catalog.listTracks(stage).then(setTracks).catch(() => {});
    else catalog.listStageSubjects(stage).then(setScopedSubjects).catch(() => {});
  }, [stage, needsTrack]);

  useEffect(() => {
    if (prevTrack.current !== track) {
      prevTrack.current = track;
      setSubject(undefined);
    }
    if (stage && needsTrack && track) {
      catalog.listStageSubjects(stage, track).then(setScopedSubjects).catch(() => {});
    }
  }, [track, stage, needsTrack]);

  // Debounce the free-text name so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setNameQuery(name.trim()), 350);
    return () => clearTimeout(t);
  }, [name]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listTeachers({ market, name: nameQuery || undefined, stage, track, subject, gender, language, weekday, min_rating: minRating, ordering, page, page_size: PAGE_SIZE })
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
  }, [market, nameQuery, stage, track, subject, gender, language, weekday, minRating, ordering, page, reloads, dict.loadError]);

  useEffect(() => setPage(1), [market, nameQuery, stage, track, subject, gender, language, weekday, minRating, ordering]);

  // Subject options: scoped to the chosen stage/track when set, else the full list.
  const subjectOptions = stage
    ? scopedSubjects.map((ss) => ({
        value: ss.subject,
        label: ar ? ss.subject_name_ar : ss.subject_name_en,
      }))
    : subjects.map((s) => ({ value: s.id, label: subjectName(s) }));

  const advancedCount =
    (gender ? 1 : 0) +
    (language ? 1 : 0) +
    (weekday != null ? 1 : 0) +
    (minRating != null ? 1 : 0) +
    (ordering !== "-rating_avg" ? 1 : 0);
  const anyFilter =
    nameQuery !== "" || stage != null || track != null || subject != null || advancedCount > 0;

  function clearAll() {
    setName("");
    setNameQuery("");
    setStage(undefined);
    setTrack(undefined);
    setSubject(undefined);
    setGender(undefined);
    setLanguage(undefined);
    setWeekday(undefined);
    setMinRating(undefined);
    setOrdering("-rating_avg");
  }

  const weekdayLabels = dict.weekdays ?? [];
  // Removable summary chips for each applied filter.
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (nameQuery) activeChips.push({ key: "name", label: `"${nameQuery}"`, clear: () => { setName(""); setNameQuery(""); } });
  // A deep link can carry an id the catalog lists don't know (stale URL, other
  // market). Fall back to the filter's own name so the chip is still readable
  // and, more importantly, still removable.
  if (stage != null) activeChips.push({ key: "stage", label: activeStage ? catalogName(activeStage, locale) : dict.stageFilter, clear: () => setStage(undefined) });
  if (track != null) { const t = tracks.find((x) => x.id === track); activeChips.push({ key: "track", label: t ? catalogName(t, locale) : dict.branchFilter, clear: () => setTrack(undefined) }); }
  if (subject != null) { const opt = subjectOptions.find((o) => o.value === subject); activeChips.push({ key: "subject", label: opt?.label || dict.subject, clear: () => setSubject(undefined) }); }
  if (gender) activeChips.push({ key: "gender", label: gender === "MALE" ? dict.male : dict.female, clear: () => setGender(undefined) });
  if (language) activeChips.push({ key: "language", label: language === "ar" ? dict.arabic : dict.english, clear: () => setLanguage(undefined) });
  if (weekday != null) activeChips.push({ key: "weekday", label: weekdayLabels[weekday] ?? "", clear: () => setWeekday(undefined) });
  if (minRating != null) activeChips.push({ key: "rating", label: `${minRating}+`, clear: () => setMinRating(undefined) });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
      </header>

      {/* Search panel: free text, subject, then the stage rails it scopes. */}
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={dict.searchNamePlaceholder}
            aria-label={dict.searchNamePlaceholder}
            startSlot={<Search aria-hidden />}
            endSlot={
              name ? (
                <button type="button" aria-label={dict.clearFilters} onClick={() => setName("")}>
                  <X aria-hidden />
                </button>
              ) : undefined
            }
          />
          <div className="flex gap-2">
            <Combobox
              value={subject}
              onChange={setSubject}
              options={subjectOptions}
              placeholder={dict.searchPlaceholder}
              searchPlaceholder={dict.searchSubjects}
              emptyText={dict.noMatches}
              clearLabel={dict.clearSelection}
              startSlot={<BookOpen aria-hidden />}
              className="min-w-0 flex-1"
            />
            <Button
              variant="outline"
              onClick={() => setFiltersOpen(true)}
              className="shrink-0 px-3.5 sm:px-4"
            >
              <SlidersHorizontal aria-hidden />
              <span className="hidden sm:inline">{dict.filters}</span>
              {advancedCount > 0 ? (
                <Badge variant="solid" size="sm" className="min-w-5 justify-center px-1.5">
                  {advancedCount}
                </Badge>
              ) : null}
            </Button>
          </div>
        </div>

        {/* Stage rail */}
        <ChipRail>
          <Chip active={stage == null} onClick={() => setStage(undefined)}>{dict.allStages}</Chip>
          {stages.map((s) => (
            <Chip key={s.id} active={stage === s.id} onClick={() => setStage(s.id)}>{catalogName(s, locale)}</Chip>
          ))}
        </ChipRail>

        {/* Branch / faculty rail */}
        {needsTrack && tracks.length > 0 ? (
          <ChipRail>
            <Chip active={track == null} onClick={() => setTrack(undefined)}>
              {activeStage?.child_kind === "FACULTY" ? dict.allFaculties : dict.allBranches}
            </Chip>
            {tracks.map((t) => (
              <Chip key={t.id} active={track === t.id} onClick={() => setTrack(t.id)}>{catalogName(t, locale)}</Chip>
            ))}
          </ChipRail>
        ) : null}
      </Card>

      {/* Applied filters — each removable */}
      {activeChips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <span
              key={c.key}
              dir="auto"
              className="inline-flex items-center gap-1 rounded-pill bg-brand-tint py-1 pe-1.5 ps-3 t-caption font-semibold text-on-brand-tint"
            >
              {c.label}
              <button
                type="button"
                aria-label={`${dict.removeFilter}: ${c.label}`}
                onClick={c.clear}
                className="rounded-full p-0.5 transition-colors hover:bg-brand hover:text-on-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={clearAll} className="link-brand t-small font-semibold">
            {dict.clearFilters}
          </button>
        </div>
      ) : null}

      {/* Results */}
      {error ? (
        <Alert
          variant="error"
          title={error}
          action={
            <Button variant="outline" size="sm" onClick={() => setReloads((n) => n + 1)}>
              {dict.retry}
            </Button>
          }
        />
      ) : loading ? (
        <div className="flex flex-col gap-4" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <TeacherCardSkeleton key={i} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SearchX aria-hidden />}
            title={dict.empty}
            description={dict.emptyHint}
            action={
              anyFilter ? (
                <Button variant="outline" onClick={clearAll}>
                  {dict.clearFilters}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <p aria-live="polite" className="t-small text-ink-muted">
            {dict.resultsCount.replace("{count}", String(total))}
          </p>

          <div className="flex flex-col gap-4">
            {rows.map((t) => (
              <TeacherCard key={t.id} teacher={t} locale={locale} dict={dict} subjectName={subjectName} />
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onChange={setPage}
            prevLabel={dict.prevPage}
            nextLabel={dict.nextPage}
            className="pt-2"
          />
        </>
      )}

      {/* Advanced filters — bottom sheet on every width; the shape mobile needs
          and one less layout to maintain. */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>{dict.filters}</SheetTitle>
          </SheetHeader>
          <SheetBody>
            <div className="mx-auto flex max-w-md flex-col gap-4">
              <FilterSelect
                label={dict.gender}
                placeholder={dict.anyGender}
                value={gender}
                onChange={setGender}
                options={[
                  { value: "MALE", label: dict.male },
                  { value: "FEMALE", label: dict.female },
                ]}
              />
              <FilterSelect
                label={dict.language}
                placeholder={dict.anyLanguage}
                value={language}
                onChange={setLanguage}
                options={[
                  { value: "ar", label: dict.arabic },
                  { value: "en", label: dict.english },
                ]}
              />
              <FilterSelect
                label={dict.availableOn}
                placeholder={dict.anyDay}
                value={weekday == null ? undefined : String(weekday)}
                onChange={(v) => setWeekday(v == null ? undefined : Number(v))}
                options={weekdayLabels.map((label, i) => ({ value: String(i), label }))}
              />
              <FilterSelect
                label={dict.minRating}
                placeholder={dict.anyRating}
                value={minRating == null ? undefined : String(minRating)}
                onChange={(v) => setMinRating(v == null ? undefined : Number(v))}
                options={[3, 3.5, 4, 4.5].map((r) => ({
                  value: String(r),
                  label: dict.ratingAndUp.replace("{n}", String(r)),
                }))}
              />
              <FilterSelect
                label={dict.sortBy}
                value={ordering}
                onChange={(v) => setOrdering(v ?? "-rating_avg")}
                options={[
                  { value: "-rating_avg", label: dict.sortRating },
                  { value: "from_price_minor", label: dict.sortPriceAsc },
                  { value: "-lessons_count", label: dict.sortLessons },
                ]}
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" block onClick={clearAll}>{dict.clearFilters}</Button>
            <Button block onClick={() => setFiltersOpen(false)}>{dict.showResults}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

/** Horizontally scrolling filter row: full-bleed on mobile so it reads as scrollable. */
function ChipRail({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {children}
    </div>
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
      aria-pressed={active}
      onClick={onClick}
      className={cn("chip shrink-0 px-3.5 py-1.5 t-small font-semibold", active && "is-active")}
    >
      {children}
    </button>
  );
}

/**
 * One labelled filter. `undefined` is "any": Radix Select has no empty value,
 * so it travels as a sentinel option and is translated back here.
 */
function FilterSelect({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  /** Provide to offer an "any" choice; omit for a required select. */
  placeholder?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  options: { value: string; label: string }[];
}) {
  const id = `filter-${label}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? (placeholder ? ANY : undefined)}
        onValueChange={(v) => onChange(v === ANY ? undefined : v)}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {placeholder ? <SelectItem value={ANY}>{placeholder}</SelectItem> : null}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TeacherCardSkeleton() {
  return (
    <Card className="flex gap-4 p-4 sm:gap-5 sm:p-5">
      <Skeleton className="size-20 rounded-card sm:size-28" />
      <div className="flex flex-1 flex-col gap-2.5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-3.5 w-full max-w-md" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </Card>
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
  const bio = (ar ? t.bio_ar : t.bio_en) || t.bio_en || t.bio_ar || "";
  const langs = t.languages.filter(Boolean).map((l) => languageName(l, dict));
  const subjects = t.subjects.map((s) => ({ id: s.id, label: subjectName(s) }));

  return (
    <Link href={`/${locale}/teachers/${t.id}`} className="group block">
      <Card interactive className="flex gap-4 p-4 sm:gap-5 sm:p-5">
        <Avatar
          src={t.photo_url}
          name={t.full_name}
          className="size-20 shrink-0 text-2xl sm:size-28 sm:text-3xl"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Name + price. The price is the second thing a parent looks at, so
              it gets its own column rather than a line in the meta row. */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 dir="auto" className="line-clamp-2 t-h4 text-ink">{t.full_name}</h3>
              {langs.length > 0 ? (
                <p dir="auto" className="mt-0.5 flex items-center gap-1 truncate t-caption text-ink-muted">
                  <Languages className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{langs.join(" · ")}</span>
                </p>
              ) : null}
            </div>
            {t.from_price ? (
              <div className="shrink-0 text-end">
                <div className="t-caption text-ink-faint">{dict.from}</div>
                <div className="font-display text-lg font-bold leading-tight text-ink">
                  {t.from_price.display}
                </div>
                <div className="t-caption text-ink-faint">{dict.perLesson}</div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating value={Number(t.rating_avg) || 0} count={t.rating_count || undefined} size="sm" />
            <span className="inline-flex items-center gap-1 t-caption text-ink-muted">
              <GraduationCap className="size-3.5" aria-hidden />
              {t.lessons_count} {dict.lessons}
            </span>
          </div>

          {subjects.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {subjects.slice(0, 4).map((s) => (
                <Badge key={s.id} size="sm" className="max-w-40 truncate">
                  {s.label}
                </Badge>
              ))}
              {subjects.length > 4 ? (
                <span className="t-caption text-ink-faint">+{subjects.length - 4}</span>
              ) : null}
            </div>
          ) : null}

          {bio ? (
            <p dir="auto" className="line-clamp-2 t-small text-ink-muted">{bio}</p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-1">
            {t.free_lessons_offered > 0 ? (
              <Badge variant="trial" size="sm">{dict.freeTrialBadge}</Badge>
            ) : (
              <span />
            )}
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap t-small font-semibold text-brand transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
              {dict.viewProfile}
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
