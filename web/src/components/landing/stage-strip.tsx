"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Skeleton } from "@/components/ui/skeleton";
import type { Dictionary } from "@/i18n/dictionaries";
import { catalog, catalogName, groupStages, type Stage } from "@/lib/catalog";

type Dict = Dictionary["landing"]["stages"];

/**
 * Browse by stage, straight from the catalog.
 *
 * The hero search above lets a visitor *pick* a stage; this lets them see what
 * the stages are — which is how the grouped arms (international curricula and
 * exams) become discoverable at all. Each link is a real filter, unlike the
 * decorative subject cards further down.
 *
 * Renders nothing if the catalog can't be read: an empty section is worse than
 * no section, and every other route into discovery still works.
 */
export default function StageStrip({ locale, dict }: { locale: string; dict: Dict }) {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    catalog
      .listStages()
      .then((rows) => alive && setStages(rows.filter((s) => s.is_active)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed || (stages && stages.length === 0)) return null;

  if (!stages) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label={dict.title} className="flex flex-col gap-4">
      {groupStages(stages).map((section, i) => (
        <div key={section.group?.id ?? `plain-${i}`} className="flex flex-col gap-2">
          {section.group ? (
            <h3 className="t-caption font-semibold uppercase tracking-wide text-ink-faint">
              {catalogName(section.group, locale)}
            </h3>
          ) : null}
          <ul className="flex flex-wrap gap-2">
            {section.stages.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/${locale}/teachers?stage=${s.id}`}
                  className="chip inline-flex px-4 py-2 t-small font-semibold"
                >
                  {catalogName(s, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
