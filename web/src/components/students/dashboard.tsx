"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  MessageCircle,
  Search,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { listBookings, type Booking } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { listFavorites } from "@/lib/favorites";
import { listTeachers, type TeacherListItem } from "@/lib/teachers";
import { getWallet } from "@/lib/wallet";
import { formatWhen, subjectLabel } from "@/components/bookings/shared";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";

type Dict = Dictionary["dashboard"];

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);

/** How many upcoming lessons to pull so the soonest one is certainly among them. */
const UPCOMING_WINDOW = 100;

export default function StudentDashboard({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { user } = useAuth();
  const router = useRouter();

  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [balance, setBalance] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [favorites, setFavorites] = useState<TeacherListItem[]>([]);
  const [recommended, setRecommended] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    // The list is ordered -scheduled_start, so ask the API for confirmed
    // lessons from now on: the soonest one is the LAST row, and `count` is the
    // real total rather than whatever fits on page one.
    const from = new Date().toISOString();
    Promise.all([
      listBookings("CONFIRMED", { from, page_size: UPCOMING_WINDOW }),
      listBookings("COMPLETED", { page_size: 1 }),
      chatApi.unreadCount().catch(() => ({ unread_count: 0 })),
      listFavorites().catch(() => []),
      getWallet().catch(() => null),
    ])
      .then(async ([up, done, uc, favs, wallet]) => {
        if (!active) return;
        setUpcoming(up.results);
        setUpcomingCount(up.count);
        setCompletedCount(done.count);
        setUnread(uc.unread_count);
        setFavorites(favs);
        setBalance(wallet?.wallet.available_display ?? null);
        const market = user?.market;
        if (market) {
          const rec = await listTeachers({
            market,
            ordering: "-rating_avg",
            page_size: 8,
          }).catch(() => null);
          if (active && rec) setRecommended(rec.results);
        }
      })
      .catch((err) => active && setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [dict.loadError, user?.market]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(`/${locale}/teachers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  const next = upcoming[upcoming.length - 1];
  const firstName = (user?.full_name || "").split(" ")[0] || "";
  const savedIds = new Set(favorites.map((t) => t.id));
  const suggestions = recommended.filter((t) => !savedIds.has(t.id)).slice(0, 8);

  return (
    <section className="flex flex-col gap-8">
      {/* Greeting + the real search that used to be a decorative pill. */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 dir="auto" className="t-h1 text-ink">
            {fill(dict.title, { name: firstName })}
          </h1>
          <p className="t-body text-ink-muted">{dict.subtitle}</p>
        </div>

        <form onSubmit={search} className="flex gap-2" role="search">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={dict.searchPrompt}
            placeholder={dict.searchPrompt}
            startSlot={<Search aria-hidden />}
            className="h-12 flex-1 rounded-pill"
          />
          <Button type="submit" size="md" pill className="h-12 px-6">
            {dict.searchAction}
          </Button>
        </form>
      </div>

      {error ? <Alert variant="error" title={error} /> : null}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <NextLesson dict={dict} locale={locale} booking={next} />

          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              icon={<CalendarClock aria-hidden />}
              label={dict.statUpcoming}
              value={String(upcomingCount)}
            />
            <Stat
              icon={<CheckCircle2 aria-hidden />}
              label={dict.statCompleted}
              value={String(completedCount)}
            />
            <Stat
              icon={<WalletIcon aria-hidden />}
              label={dict.statBalance}
              value={balance ?? "—"}
              action={
                <Link href={`/${locale}/wallet`} className="link-brand t-caption font-semibold">
                  {dict.quickTopUp}
                </Link>
              }
            />
          </div>

          {favorites.length > 0 ? (
            <TeacherRail
              title={dict.yourTeachers}
              href={`/${locale}/favorites`}
              viewAll={dict.viewAll}
              teachers={favorites}
              locale={locale}
            />
          ) : null}

          {suggestions.length > 0 ? (
            <TeacherRail
              title={dict.recommended}
              href={`/${locale}/teachers`}
              viewAll={dict.viewAll}
              teachers={suggestions}
              locale={locale}
            />
          ) : favorites.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users aria-hidden />}
                title={dict.noFavorites}
                description={dict.noRecommended}
                action={
                  <Button asChild>
                    <Link href={`/${locale}/teachers`}>{dict.findCta}</Link>
                  </Button>
                }
              />
            </Card>
          ) : null}

          <Link href={`/${locale}/messages`} className="group block">
            <Card interactive className="flex items-center gap-3 p-4 sm:p-5">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-brand-tint text-on-brand-tint">
                <MessageCircle className="size-5" aria-hidden />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="t-small font-semibold text-ink">{dict.messagesTitle}</span>
                <span className="t-caption text-ink-muted">
                  {unread > 0 ? fill(dict.unreadMessages, { n: String(unread) }) : dict.allRead}
                </span>
              </div>
              {unread > 0 ? <Badge variant="solid" size="sm">{unread}</Badge> : null}
              <ArrowRight
                className="size-4.5 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </Card>
          </Link>
        </>
      )}
    </section>
  );
}

/**
 * The one card a returning student is here for. A calendar tile carries the
 * date so the card is scannable without reading it — and when there is nothing
 * booked, the same slot asks for the next booking instead of going blank.
 */
function NextLesson({
  dict,
  locale,
  booking,
}: {
  dict: Dict;
  locale: Locale;
  booking: Booking | undefined;
}) {
  if (!booking) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-col gap-0.5">
          <span className="t-overline text-ink-faint">{dict.nextLesson}</span>
          <span className="t-body text-ink-muted">{dict.noUpcoming}</span>
        </div>
        <Button asChild>
          <Link href={`/${locale}/teachers`}>
            {dict.findCta}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </Link>
        </Button>
      </Card>
    );
  }

  const start = new Date(booking.scheduled_start);
  const day = start.toLocaleDateString(locale, { day: "numeric" });
  const month = start.toLocaleDateString(locale, { month: "short" });

  return (
    <Card className="flex flex-wrap items-center gap-4 border-brand/30 p-5">
      <span
        aria-hidden
        className="flex size-16 shrink-0 flex-col items-center justify-center rounded-card bg-brand-tint leading-none text-on-brand-tint"
      >
        <span className="font-display text-xl font-bold">{day}</span>
        <span className="mt-1 t-caption">{month}</span>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="t-overline text-ink-faint">{dict.nextLesson}</span>
        <span dir="auto" className="t-h4 text-ink">
          {subjectLabel(booking, locale)}
        </span>
        {/* <bdi> per value: a Latin teacher name beside an Arabic-formatted
            date is two directions in one line. */}
        <span className="t-small text-ink-muted">
          <bdi>{fill(dict.withTeacher, { teacher: booking.teacher_name })}</bdi> ·{" "}
          <bdi>{formatWhen(booking.scheduled_start, locale)}</bdi>
        </span>
      </div>

      {booking.meeting_link ? (
        <Button asChild>
          <a href={booking.meeting_link} target="_blank" rel="noreferrer">
            {dict.join}
          </a>
        </Button>
      ) : null}
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-brand-tint text-on-brand-tint [&_svg]:size-4.5">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span dir="auto" className="font-display text-lg font-bold text-ink">
          {value}
        </span>
        <span className="t-caption text-ink-muted">{label}</span>
      </div>
      {action ? <div className="ms-auto shrink-0">{action}</div> : null}
    </Card>
  );
}

/**
 * Horizontal teacher rail. Scroll-snap so a swipe lands a card flush against
 * the gutter instead of halfway off screen; the negative margin lets the rail
 * bleed to the edge on mobile while its first card stays aligned with the page.
 */
function TeacherRail({
  title,
  href,
  viewAll,
  teachers,
  locale,
}: {
  title: string;
  href: string;
  viewAll: string;
  teachers: TeacherListItem[];
  locale: Locale;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-h3 text-ink">{title}</h2>
        <Link href={href} className="link-brand shrink-0 t-small font-semibold">
          {viewAll}
        </Link>
      </div>

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {teachers.map((t) => (
          <Link key={t.id} href={`/${locale}/teachers/${t.id}`} className="snap-start">
            <Card
              interactive
              className="flex h-full w-40 shrink-0 flex-col items-center gap-2 p-4 text-center sm:w-44"
            >
              <Avatar src={t.photo_url} name={t.full_name} shape="circle" className="size-16 text-2xl" />
              <div dir="auto" className="w-full truncate t-small font-semibold text-ink">
                {t.full_name}
              </div>
              {Number(t.rating_avg) > 0 ? (
                <Rating
                  value={Number(t.rating_avg)}
                  count={t.rating_count || undefined}
                  size="sm"
                />
              ) : null}
              {t.from_price ? (
                <div className="mt-auto t-caption font-semibold text-ink">{t.from_price.display}</div>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-card" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-40 shrink-0 rounded-card sm:w-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
