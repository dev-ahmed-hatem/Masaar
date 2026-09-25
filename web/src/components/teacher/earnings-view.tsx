"use client";

import { useCallback, useEffect, useState } from "react";
import { Hourglass, Wallet } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { myPayouts, type ItemStatus, type PayoutItem } from "@/lib/payouts";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";

type Dict = Dictionary["teacherEarnings"];

export default function EarningsView({ dict, locale }: { dict: Dict; locale: string }) {
  const [rows, setRows] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    myPayouts()
      .then(setRows)
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  const sum = (status: ItemStatus) =>
    rows.filter((r) => r.status === status).reduce((s, r) => s + r.amount_minor, 0);
  const currency = rows[0]?.currency ?? "";
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${currency}`.trim();

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
        <div className="flex flex-col gap-3" aria-busy>
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[74px] rounded-card" />
            <Skeleton className="h-[74px] rounded-card" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Wallet aria-hidden />} title={dict.empty} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat icon={<Wallet aria-hidden />} label={dict.totalPaid} value={money(sum("PAID"))} />
            <Stat
              icon={<Hourglass aria-hidden />}
              label={dict.totalPending}
              value={money(sum("PENDING"))}
            />
          </div>

          <div className="flex flex-col gap-2">
            {rows.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="t-body font-bold text-ink">{r.amount_display}</span>
                  <span className="t-caption text-ink-muted">
                    {r.lessons_count} {dict.colLessons}
                    {r.paid_at
                      ? ` · ${dict.paidOn.replace(
                          "{date}",
                          new Date(r.paid_at).toLocaleDateString(locale, { dateStyle: "medium" }),
                        )}`
                      : ""}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </span>
                </div>
                <Badge variant={r.status === "PAID" ? "success" : "warning"}>
                  {r.status === "PAID" ? dict.statusPAID : dict.statusPENDING}
                </Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
