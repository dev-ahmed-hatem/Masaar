"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/dictionaries";
import { guessMarket } from "@/lib/markets";
import { listTeachers, type TeacherListItem } from "@/lib/teachers";

type Dict = Dictionary["landing"]["featured"];
type BrowseDict = Dictionary["browse"];

const COUNT = 6;

/**
 * Real top-rated teachers as social proof.
 *
 * Client-side because the teacher list is market-scoped and the market is a
 * per-visitor guess (saved country -> device timezone -> EG), which a
 * statically rendered page cannot know. Renders skeletons while loading and
 * disappears entirely if the market has no published teachers yet.
 */
export default function FeaturedTeachers({
  locale,
  dict,
  browse,
}: {
  locale: string;
  dict: Dict;
  browse: BrowseDict;
}) {
  const [rows, setRows] = useState<TeacherListItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    listTeachers({
      market: guessMarket(),
      ordering: "-rating_avg",
      page_size: COUNT,
    })
      .then((r) => alive && setRows(r.results))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  // Nothing to brag about yet — hide the section rather than show an empty grid.
  if (rows !== null && rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="t-h2 text-ink">{dict.title}</h2>
          <p className="mt-2 t-body text-ink-muted">{dict.subtitle}</p>
        </div>
        <Link
          href={`/${locale}/teachers`}
          className="inline-flex items-center gap-1.5 t-small font-semibold text-brand hover:underline"
        >
          {dict.viewAll}
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows === null
          ? Array.from({ length: COUNT }).map((_, i) => (
              <li key={i}>
                <Card className="flex gap-4 p-4">
                  <Skeleton className="size-20 rounded-card" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </Card>
              </li>
            ))
          : rows.map((t) => (
              <li key={t.id}>
                <TeacherMiniCard locale={locale} teacher={t} browse={browse} />
              </li>
            ))}
      </ul>
    </section>
  );
}

function TeacherMiniCard({
  locale,
  teacher,
  browse,
}: {
  locale: string;
  teacher: TeacherListItem;
  browse: BrowseDict;
}) {
  const subjects = teacher.subjects
    .slice(0, 2)
    .map((s) => (locale === "ar" ? s.name_ar : s.name_en))
    .join(" · ");

  return (
    <Link href={`/${locale}/teachers/${teacher.id}`} className="block h-full">
      <Card interactive className="flex h-full gap-4 p-4">
        <Avatar
          size="lg"
          src={teacher.photo_url}
          name={teacher.full_name}
          className="shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p dir="auto" className="truncate font-display font-bold text-ink">{teacher.full_name}</p>

          {subjects ? <p dir="auto" className="truncate t-small text-ink-muted">{subjects}</p> : null}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Rating value={Number(teacher.rating_avg) || 0} count={teacher.rating_count} size="sm" />
            <span className="inline-flex items-center gap-1 t-caption text-ink-muted">
              <GraduationCap className="size-3.5" aria-hidden />
              {teacher.lessons_count} {browse.lessons}
            </span>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
            {teacher.from_price ? (
              <span className="t-small text-ink-muted">
                <span className="font-bold text-ink">{teacher.from_price.display}</span>{" "}
                {browse.perLesson}
              </span>
            ) : (
              <span />
            )}
            {teacher.free_lessons_offered > 0 ? (
              <Badge variant="trial" size="sm">
                {browse.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
              </Badge>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}
