"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert as AntAlert, App, Modal, Select as AntSelect, Switch } from "antd";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  CalendarX,
  GraduationCap,
  Heart,
  MessageCircle,
  PlayCircle,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  UserX,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError, apiAuthed } from "@/lib/api";
import { createBooking } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { cn } from "@/lib/cn";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";
import { refName, stageCardTitle, type StageCard } from "@/lib/stage-cards";
import type { Paginated } from "@/lib/teachers";
import { getTeacher, languageName, type TeacherDetail as Teacher } from "@/lib/teachers";
import { DetailRow } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Rating } from "@/components/ui/rating";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import TeacherSchedule from "@/components/students/teacher-schedule";
import StageCardSummary from "@/components/teaching/stage-card-summary";

type Dict = Dictionary["browse"];
type CardsDict = Dictionary["stageCards"];

const SCHEDULE_ID = "teacher-schedule";

interface ReviewRow {
  id: number;
  student_name: string;
  rating: number;
  text: string;
  created_at: string;
}

/** Extract a YouTube video id from common URL shapes (watch, youtu.be, embed). */
function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

function yearRange(start: string, end: string, present: string): string {
  if (!start && !end) return "";
  if (start && !end) return `${start} – ${present}`;
  return [start, end].filter(Boolean).join(" – ");
}

/** A card students can book: it has subjects and weekly hours. */
function isBookable(card: StageCard): boolean {
  return card.subjects.length > 0 && card.availability.length > 0 && card.price.amount_minor > 0;
}

export default function TeacherDetail({
  id,
  dict,
  cards: cardsDict,
  locale,
}: {
  id: number;
  dict: Dict;
  cards: CardsDict;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const { message } = App.useApp();
  const { user } = useAuth();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [pickedStart, setPickedStart] = useState<string | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [pickedStageId, setPickedStageId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTeacher(id)
      .then((t) => active && setTeacher(t))
      .catch(() => active && setNotFound(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (user?.role !== "STUDENT") return;
    listFavorites()
      .then((favs) => setIsFav(favs.some((f) => f.id === id)))
      .catch(() => {});
  }, [id, user?.role]);

  const bookableStages = useMemo(() => (teacher?.stages ?? []).filter(isBookable), [teacher]);
  // The stage whose hours the schedule shows: the one picked, else the first bookable.
  const activeStage =
    bookableStages.find((c) => c.id === pickedStageId) ?? bookableStages[0] ?? null;

  const isStudent = user?.role === "STUDENT";
  const canAct = !user || isStudent;
  const signInHref = `/${locale}/sign-in`;

  async function onMessage() {
    if (!teacher) return;
    if (!user) return void router.push(signInHref);
    setMessaging(true);
    try {
      await chatApi.startThread(teacher.id);
      router.push(`/${locale}/messages`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setMessaging(false);
    }
  }

  async function onToggleFav() {
    if (!user) return void router.push(signInHref);
    const next = !isFav;
    setIsFav(next);
    try {
      if (next) await addFavorite(id);
      else await removeFavorite(id);
    } catch {
      setIsFav(!next);
      message.error(dict.genericError);
    }
  }

  async function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) await navigator.share({ title: teacher?.full_name, url });
      else {
        await navigator.clipboard.writeText(url);
        message.success(dict.shareCopied);
      }
    } catch {
      /* user dismissed */
    }
  }

  function onPickSlot(iso: string) {
    if (!user) return void router.push(signInHref);
    if (!isStudent) return; // teachers/admins can browse but not book
    setPickedStart(iso);
  }

  function showStageTimes(stageId: number) {
    setPickedStageId(stageId);
    setPickedStart(null);
    scrollToSchedule();
  }

  function scrollToSchedule() {
    document.getElementById(SCHEDULE_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) return <DetailSkeleton />;

  if (notFound || !teacher) {
    return (
      <Card>
        <EmptyState
          icon={<UserX aria-hidden />}
          title={dict.notFound}
          action={
            <Button variant="outline" asChild>
              <Link href={`/${locale}/teachers`}>{dict.backToList}</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  const bio = (ar ? teacher.bio_ar : teacher.bio_en) || teacher.bio_en || teacher.bio_ar;
  const rating = Number(teacher.rating_avg);
  const topRated = rating >= 4.8 && teacher.rating_count >= 10;
  const videoId = teacher.intro_video_url ? youtubeId(teacher.intro_video_url) : null;
  const langs = teacher.languages
    .filter(Boolean)
    .map((code) => ({ code, label: languageName(code, dict) }));

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={`/${locale}/teachers`}
        className="link-quiet inline-flex w-fit items-center gap-1.5 t-small font-semibold"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {dict.backToList}
      </Link>

      {/* Three grid children, not two: the hero stays above the booking card on
          mobile (who before how much), while on lg the sidebar still rises to
          the top of the page and sticks. */}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Hero */}
        <Card className="overflow-hidden lg:col-start-1 lg:row-start-1">
          {/* A thin geometry band instead of a stock cover photo. */}
          <div className="pattern-bg h-16 border-b border-border sm:h-20" aria-hidden />
          <div className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-14">
              <Avatar
                src={teacher.photo_url}
                name={teacher.full_name}
                className="size-24 text-3xl ring-4 ring-surface sm:size-28"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 dir="auto" className="t-h2 text-ink">{teacher.full_name}</h1>
                  {topRated ? (
                    <Badge variant="brand">
                      <Star className="fill-current" aria-hidden />
                      {dict.topRated}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Rating value={rating || 0} display="stars" size="sm" />
                  <span className="t-small text-ink-muted">
                    {rating > 0 ? rating.toFixed(1) : "—"} ·{" "}
                    {dict.reviewsCount.replace("{n}", String(teacher.rating_count))}
                  </span>
                  <span className="inline-flex items-center gap-1 t-small text-ink-muted">
                    <GraduationCap className="size-4" aria-hidden />
                    {teacher.lessons_count} {dict.lessons}
                  </span>
                </div>
              </div>
            </div>

            {(langs.length > 0 || teacher.free_lessons_offered > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {langs.map((l) => (
                  <Badge key={l.code} size="sm">{l.label}</Badge>
                ))}
                {teacher.free_lessons_offered > 0 ? (
                  <Badge variant="trial" size="sm">
                    {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
                  </Badge>
                ) : null}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {canAct ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onToggleFav}
                  aria-pressed={isFav}
                  className={cn(isFav && "border-brand text-brand")}
                >
                  <Heart className={cn(isFav && "fill-current")} aria-hidden />
                  {isFav ? dict.saved : dict.save}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={onShare}>
                <Share2 aria-hidden />
                {dict.share}
              </Button>
            </div>
          </div>
        </Card>

        {/* Booking sidebar — the focal point of the page */}
        <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <BookingPanel
            teacher={teacher}
            dict={dict}
            videoId={videoId}
            signedIn={Boolean(user)}
            messaging={messaging}
            onMessage={onMessage}
            onBook={scrollToSchedule}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-2">
          {/* About */}
          {bio ? (
            <Section icon={<BookOpen aria-hidden />} title={dict.aboutTitle}>
              <ExpandableText text={bio} more={dict.readMore} less={dict.readLess} />
            </Section>
          ) : null}

          {/* Specialties */}
          {teacher.specialties.length > 0 ? (
            <Section icon={<Sparkles aria-hidden />} title={dict.specialtiesTitle}>
              <div className="flex flex-wrap gap-1.5">
                {teacher.specialties.map((s, i) => (
                  <Badge key={i} variant="brand" dir="auto">{s}</Badge>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Stages & prices: each stage card's subjects, price, trials and hours */}
          {teacher.stages.length > 0 ? (
            <Section icon={<GraduationCap aria-hidden />} title={dict.stagesTitle}>
              <div className="flex flex-col gap-3">
                {teacher.stages.map((card) => (
                  <StageCardSummary
                    key={card.id}
                    card={card}
                    dict={cardsDict}
                    locale={locale}
                    actions={
                      isBookable(card) ? (
                        <Button variant="outline" size="sm" onClick={() => showStageTimes(card.id)}>
                          <CalendarDays aria-hidden />
                          {dict.seeTimes}
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </Section>
          ) : null}

          {/* Schedule — the centerpiece */}
          <Section id={SCHEDULE_ID} icon={<CalendarDays aria-hidden />} title={dict.scheduleTitle}>
            <p className="-mt-2 mb-4 t-small text-ink-muted">{dict.scheduleIntro}</p>
            {bookableStages.length > 1 && activeStage ? (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="t-small font-semibold text-ink">{dict.stageLabel}</span>
                <Select
                  value={String(activeStage.id)}
                  onValueChange={(v) => {
                    setPickedStageId(Number(v));
                    setPickedStart(null);
                  }}
                >
                  <SelectTrigger aria-label={dict.chooseStage} className="w-auto min-w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bookableStages.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {`${stageCardTitle(c, locale)} · ${c.price.display}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <TeacherSchedule
              key={activeStage?.id ?? 0}
              teacherId={teacher.id}
              stageId={activeStage?.id ?? null}
              locale={locale}
              dict={dict}
              onPick={onPickSlot}
              onMessage={onMessage}
              selected={pickedStart ?? undefined}
            />
          </Section>

          {/* Education */}
          {teacher.education.length > 0 ? (
            <Section icon={<GraduationCap aria-hidden />} title={dict.educationTitle}>
              <ResumeList>
                {teacher.education.map((e, i) => (
                  <ResumeItem
                    key={i}
                    title={e.degree}
                    subtitle={e.institution}
                    meta={yearRange(e.start_year, e.end_year, dict.present)}
                    description={e.description}
                  />
                ))}
              </ResumeList>
            </Section>
          ) : null}

          {/* Work experience */}
          {teacher.work_experience.length > 0 ? (
            <Section icon={<Briefcase aria-hidden />} title={dict.experienceTitle}>
              <ResumeList>
                {teacher.work_experience.map((e, i) => (
                  <ResumeItem
                    key={i}
                    title={e.title}
                    subtitle={e.organization}
                    meta={yearRange(e.start_year, e.end_year, dict.present)}
                    description={e.description}
                  />
                ))}
              </ResumeList>
            </Section>
          ) : null}

          {/* Certifications */}
          {teacher.certifications.length > 0 ? (
            <Section icon={<Award aria-hidden />} title={dict.certificationsTitle}>
              <ResumeList>
                {teacher.certifications.map((c, i) => (
                  <ResumeItem
                    key={i}
                    title={c.name}
                    subtitle={c.issuer}
                    meta={c.year}
                    description={c.description}
                  />
                ))}
              </ResumeList>
            </Section>
          ) : null}

          {/* Reviews */}
          <Section
            icon={<Star aria-hidden />}
            title={`${dict.reviews} (${teacher.reviews_summary.rating_count})`}
          >
            <ReviewsSection teacherId={id} locale={locale} dict={dict} seed={teacher.recent_reviews} />
          </Section>
        </div>
      </div>

      {pickedStart && activeStage ? (
        <BookingModal
          stage={activeStage}
          startIso={pickedStart}
          dict={dict}
          locale={locale}
          onClose={() => setPickedStart(null)}
        />
      ) : null}
    </section>
  );
}

/**
 * Price, the two calls to action and the reasons to trust them. Sticky on
 * desktop; on mobile it sits directly under the hero, above everything else.
 */
function BookingPanel({
  teacher,
  dict,
  videoId,
  signedIn,
  messaging,
  onMessage,
  onBook,
}: {
  teacher: Teacher;
  dict: Dict;
  videoId: string | null;
  signedIn: boolean;
  messaging: boolean;
  onMessage: () => void;
  onBook: () => void;
}) {
  return (
    <Card className="overflow-hidden lg:sticky lg:top-20">
      {videoId ? (
        <div className="relative w-full border-b border-border" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={teacher.full_name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : teacher.intro_video_url ? (
        <a
          href={teacher.intro_video_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 border-b border-border px-5 py-4 t-small font-semibold text-brand hover:underline"
        >
          <PlayCircle className="size-4" aria-hidden />
          {dict.introVideo}
        </a>
      ) : null}

      <div className="flex flex-col gap-4 p-5">
        {teacher.from_price ? (
          <div>
            <div className="t-caption text-ink-faint">{dict.from}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold leading-none text-ink">
                {teacher.from_price.display}
              </span>
              <span className="t-caption text-ink-faint">{dict.perLesson}</span>
            </div>
          </div>
        ) : null}

        {teacher.free_lessons_offered > 0 ? (
          <Badge variant="trial" className="w-fit">
            {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
          </Badge>
        ) : null}

        <div className="flex flex-col gap-2">
          {/* Amber is the conversion CTA and appears once per view. */}
          <Button variant="accent" size="lg" block onClick={onBook}>
            <CalendarDays aria-hidden />
            {signedIn ? dict.bookLesson : dict.signInToBook}
          </Button>
          <Button variant="outline" size="lg" block loading={messaging} onClick={onMessage}>
            <MessageCircle aria-hidden />
            {dict.message}
          </Button>
        </div>

        <Separator />

        <ul className="flex flex-col gap-2.5">
          <TrustLine icon={<ShieldCheck aria-hidden />}>{dict.trustVetted}</TrustLine>
          <TrustLine icon={<CalendarX aria-hidden />}>{dict.trustCancel}</TrustLine>
        </ul>
      </div>
    </Card>
  );
}

function Section({
  icon,
  title,
  id,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 t-h3 text-ink">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-brand-tint text-on-brand-tint [&_svg]:size-4">
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </Card>
  );
}

function TrustLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 t-small text-ink-muted">
      <span className="mt-0.5 shrink-0 text-brand [&_svg]:size-4">{icon}</span>
      {children}
    </li>
  );
}

/**
 * Long bios get clamped with a toggle. Bios run to several paragraphs and the
 * schedule — the thing the page is for — should stay within reach.
 */
function ExpandableText({ text, more, less }: { text: string; more: string; less: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <div className="flex flex-col items-start gap-2">
      <p
        dir="auto"
        className={cn("whitespace-pre-line t-body text-ink-muted", long && !open && "line-clamp-6")}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="link-brand t-small font-semibold"
        >
          {open ? less : more}
        </button>
      ) : null}
    </div>
  );
}

/** Résumé rail: a hairline with a node per entry — reads as a timeline. */
function ResumeList({ children }: { children: React.ReactNode }) {
  return <ol className="flex flex-col gap-5 border-s border-border ps-5">{children}</ol>;
}

function ResumeItem({
  title,
  subtitle,
  meta,
  description,
}: {
  title: string;
  subtitle: string;
  meta: string;
  description: string;
}) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className="absolute top-1.5 start-[-1.5625rem] size-2.5 rounded-full border-2 border-surface bg-brand"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span dir="auto" className="t-body font-semibold text-ink">{title || subtitle}</span>
        {meta ? <span className="t-caption text-ink-faint">{meta}</span> : null}
      </div>
      {title && subtitle ? (
        <div dir="auto" className="t-small text-ink-muted">{subtitle}</div>
      ) : null}
      {description ? (
        <p dir="auto" className="mt-1 whitespace-pre-line t-small text-ink-muted">{description}</p>
      ) : null}
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex gap-4">
            <Skeleton className="size-24 rounded-card" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        </Card>
        <Card className="flex flex-col gap-3 p-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </Card>
      </div>
      <Card className="flex flex-col gap-3 p-5">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Card>
    </div>
  );
}

function ReviewsSection({
  teacherId,
  locale,
  dict,
  seed,
}: {
  teacherId: number;
  locale: Locale;
  dict: Dict;
  seed: { rating: number; text: string; student_name: string; created_at: string }[];
}) {
  const [reviews, setReviews] = useState<ReviewRow[]>(seed.map((r, i) => ({ id: -i - 1, ...r })));
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(seed.length >= 10);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    const nextPage = page + 1;
    try {
      const res = await apiAuthed<Paginated<ReviewRow>>(`/api/reviews/?teacher=${teacherId}&page=${nextPage}`);
      setReviews((prev) => [...prev, ...res.results]);
      setHasNext(Boolean(res.next));
      setPage(nextPage);
    } catch {
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }

  if (reviews.length === 0) {
    return <p className="t-small text-ink-muted">{dict.noReviews}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-card border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Rating value={r.rating} display="stars" size="sm" />
              <span dir="auto" className="t-small font-semibold text-ink">{r.student_name}</span>
            </div>
            <span className="t-caption text-ink-faint">
              {new Date(r.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
            </span>
          </div>
          {r.text ? (
            <p dir="auto" className="mt-1.5 t-small text-ink-muted">{r.text}</p>
          ) : null}
        </div>
      ))}
      {hasNext ? (
        <Button variant="outline" size="sm" loading={loading} onClick={loadMore} className="self-start">
          {dict.loadMore}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Booking confirmation. Still antd: the modal, its error mapping and the
 * mobile sheet variant are Phase 3 of the redesign, together with the slot
 * calendar it opens from.
 */
function BookingModal({
  stage,
  startIso,
  dict,
  locale,
  onClose,
}: {
  stage: StageCard;
  startIso: string;
  dict: Dict;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [subjectId, setSubjectId] = useState<number | undefined>(stage.subjects[0]?.id);
  const [isTrial, setIsTrial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lowFunds, setLowFunds] = useState(false);

  const whenLabel = new Date(startIso).toLocaleString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function submit() {
    if (!subjectId) return;
    setSubmitting(true);
    setLowFunds(false);
    try {
      await createBooking({
        teacher_stage: stage.id,
        subject: subjectId,
        scheduled_start: startIso,
        is_trial: isTrial,
      });
      message.success(dict.bookSuccess);
      onClose();
      router.push(`/${locale}/lessons`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "insufficient_balance") {
        setLowFunds(true);
        message.error(dict.errFunds);
      } else if (code === "market_mismatch") message.error(dict.errMarket);
      else if (code === "trial_unavailable") message.error(dict.errTrial);
      else if (code === "slot_unavailable") message.error(dict.errSlot);
      else message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  const priceText = isTrial ? dict.free : stage.price.display;

  return (
    <Modal
      open
      onCancel={onClose}
      title={dict.bookTitle}
      okText={dict.confirm}
      okButtonProps={{ disabled: !subjectId, loading: submitting }}
      onOk={submit}
    >
      <div className="flex flex-col gap-4 py-2">
        <DetailRow label={dict.selectedTime} value={<strong dir="ltr">{whenLabel}</strong>} />

        <DetailRow label={dict.stageLabel} value={stageCardTitle(stage, locale)} />

        {stage.subjects.length > 1 ? (
          <label className="flex flex-col gap-1">
            <span className="t-small font-medium text-ink-muted">{dict.chooseSubject}</span>
            <AntSelect
              value={subjectId}
              onChange={setSubjectId}
              style={{ width: "100%" }}
              options={stage.subjects.map((s) => ({ value: s.id, label: refName(s, locale) }))}
            />
          </label>
        ) : (
          <DetailRow label={dict.subject} value={refName(stage.subjects[0], locale)} />
        )}

        {stage.free_lessons_offered > 0 ? (
          <label className="flex items-center gap-3">
            <Switch checked={isTrial} onChange={setIsTrial} />
            <span className="t-small text-ink">{dict.trialToggle}</span>
          </label>
        ) : null}

        <DetailRow label={dict.priceLabel} value={<strong>{priceText}</strong>} />

        {lowFunds ? (
          <AntAlert
            type="warning"
            showIcon
            message={dict.errFunds}
            action={
              <Link href={`/${locale}/wallet`} className="link-brand font-semibold">
                {dict.topUp}
              </Link>
            }
          />
        ) : null}
      </div>
    </Modal>
  );
}
