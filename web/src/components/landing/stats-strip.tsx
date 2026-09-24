"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/dictionaries";
import { guessMarket, useMarkets } from "@/lib/markets";
import { listSubjects, listTeachers } from "@/lib/teachers";

type Dict = Dictionary["landing"]["stats"];

/**
 * Social proof from real counts only.
 *
 * Deliberately no invented "10,000+ lessons delivered" figure: the API can
 * give us published teachers in the visitor's market, active markets and
 * catalog subjects, so those are the three we show. If a count cannot be
 * loaded the whole strip stays hidden rather than rendering a zero.
 */
export default function StatsStrip({ locale, dict }: { locale: string; dict: Dict }) {
  const markets = useMarkets(locale);
  const [teachers, setTeachers] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listTeachers({ market: guessMarket(), page_size: 1 }),
      listSubjects(),
    ])
      .then(([t, s]) => {
        if (!alive) return;
        setTeachers(t.count);
        setSubjects(s.length);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return null;

  const n = (v: number) => v.toLocaleString(locale);
  const items = [
    { value: teachers, label: dict.teachers },
    { value: markets.length || null, label: dict.countries },
    { value: subjects, label: dict.subjects },
  ];

  return (
    <dl className="grid grid-cols-3 gap-4 rounded-panel border border-border bg-surface-2 px-4 py-6 sm:gap-8 sm:px-8">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-1 text-center">
          <dt className="sr-only">{item.label}</dt>
          <dd className="t-h2 font-display font-bold text-brand">
            {item.value === null ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              n(item.value)
            )}
          </dd>
          <span className="t-small text-ink-muted">{item.label}</span>
        </div>
      ))}
    </dl>
  );
}
