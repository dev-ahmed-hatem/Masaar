"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/dictionaries";
import { listReviews, type Review } from "@/lib/reviews";

type Dict = Dictionary["landing"]["reviews"];

const COUNT = 3;

/**
 * Published reviews, straight from the API. Only reviews attached to a
 * COMPLETED booking can exist, so there is nothing to fabricate here — and if
 * there are none yet the section hides itself rather than showing placeholders.
 */
export default function LandingReviews({ dict }: { dict: Dict }) {
  const [rows, setRows] = useState<Review[] | null>(null);

  useEffect(() => {
    let alive = true;
    listReviews({ published: "true", page_size: COUNT })
      .then((r) => alive && setRows(r.results.filter((x) => x.text?.trim())))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  if (rows !== null && rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="max-w-2xl">
        <h2 className="t-h2 text-ink">{dict.title}</h2>
        <p className="mt-2 t-body text-ink-muted">{dict.subtitle}</p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows === null
          ? Array.from({ length: COUNT }).map((_, i) => (
              <li key={i}>
                <Card className="flex flex-col gap-3 p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                </Card>
              </li>
            ))
          : rows.map((r) => (
              <li key={r.id}>
                <Card className="flex h-full flex-col gap-3 p-5">
                  <Rating value={r.rating} size="sm" display="stars" />
                  <p dir="auto" className="t-body text-ink">{r.text}</p>
                  <p dir="auto" className="mt-auto t-caption text-ink-muted">
                    {r.student_name}
                    {r.teacher_name ? <span className="text-ink-faint"> · {r.teacher_name}</span> : null}
                  </p>
                </Card>
              </li>
            ))}
      </ul>
    </section>
  );
}
