"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, App, Avatar, Button, Empty, Rate, Spin, Tag } from "antd";
import { Heart } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listFavorites, removeFavorite } from "@/lib/favorites";
import type { TeacherListItem } from "@/lib/teachers";
import { PageHeader } from "@/components/ui";

type Dict = Dictionary["favorites"];

export default function FavoritesView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ar = locale === "ar";
  const { message } = App.useApp();
  const [rows, setRows] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listFavorites()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  async function remove(id: number) {
    setRows((prev) => prev.filter((t) => t.id !== id));
    try {
      await removeFavorite(id);
    } catch {
      message.error(dict.loadError);
      load();
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      {error ? (
        <Alert type="error" showIcon message={error} />
      ) : loading ? (
        <div className="flex justify-center py-20">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <Empty description={dict.empty} className="py-16">
          <Link href={`/${locale}/teachers`} className="btn btn-primary">
            {dict.browseCta}
          </Link>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className="surface flex flex-col gap-4 p-5">
              <Link href={`/${locale}/teachers/${t.id}`} className="flex items-center gap-3">
                <Avatar size={52} src={t.photo_url ?? undefined} style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700 }}>
                  {(t.full_name || "?").trim().charAt(0).toUpperCase()}
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold" style={{ color: "var(--ink)" }}>{t.full_name}</div>
                  <div className="flex items-center gap-1.5">
                    <Rate disabled allowHalf value={Number(t.rating_avg)} style={{ fontSize: 12 }} />
                    <span className="text-xs" style={{ color: "var(--ink-muted)" }}>({t.rating_count})</span>
                  </div>
                </div>
              </Link>
              <div className="flex flex-wrap gap-1">
                {t.subjects.slice(0, 3).map((s) => (
                  <Tag key={s.id} bordered={false} style={{ background: "var(--surface-2)" }}>
                    {ar ? s.name_ar : s.name_en}
                  </Tag>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                  {t.from_price?.display ?? ""}
                </span>
                <Button size="small" icon={<Heart size={14} fill="currentColor" />} onClick={() => remove(t.id)}>
                  {dict.remove}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
