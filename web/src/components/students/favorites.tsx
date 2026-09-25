"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Heart } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listFavorites, removeFavorite } from "@/lib/favorites";
import type { TeacherListItem } from "@/lib/teachers";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["favorites"];

export default function FavoritesView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ar = locale === "ar";
  const toast = useToast();
  const [rows, setRows] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listFavorites()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  async function remove(teacher: TeacherListItem) {
    // Optimistic: the heart is the only state on screen, so waiting for the
    // round trip would feel broken. A failure reloads the list from the API.
    setRows((prev) => prev.filter((t) => t.id !== teacher.id));
    try {
      await removeFavorite(teacher.id);
      toast.success(dict.removed);
    } catch {
      toast.error(dict.removeError);
      load();
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
      </header>

      {error ? (
        <Alert
          variant="error"
          title={error}
          action={
            <Button variant="outline" size="sm" onClick={load}>
              {dict.retry}
            </Button>
          }
        />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart aria-hidden />}
            title={dict.empty}
            description={dict.emptyHint}
            action={
              <Button asChild>
                <Link href={`/${locale}/teachers`}>
                  {dict.browseCta}
                  <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="flex flex-col gap-4 p-5">
              <Link href={`/${locale}/teachers/${t.id}`} className="group flex items-center gap-3">
                <Avatar
                  src={t.photo_url}
                  name={t.full_name}
                  shape="circle"
                  className="size-12 shrink-0 text-lg"
                />
                <div className="min-w-0 flex-1">
                  <div
                    dir="auto"
                    className="truncate t-body font-semibold text-ink transition-colors group-hover:text-brand"
                  >
                    {t.full_name}
                  </div>
                  {Number(t.rating_avg) > 0 ? (
                    <Rating
                      value={Number(t.rating_avg)}
                      count={t.rating_count || undefined}
                      size="sm"
                      className="mt-0.5"
                    />
                  ) : null}
                </div>
              </Link>

              {t.subjects.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {t.subjects.slice(0, 3).map((s) => (
                    <Badge key={s.id} size="sm" className="max-w-40 truncate">
                      {ar ? s.name_ar : s.name_en}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="t-small font-bold text-ink">{t.from_price?.display ?? ""}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(t)}
                  aria-label={`${dict.remove} — ${t.full_name}`}
                >
                  <Heart className="fill-current" aria-hidden />
                  {dict.remove}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
