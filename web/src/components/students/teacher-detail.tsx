"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Avatar,
  Button,
  Modal,
  Rate,
  Select,
  Spin,
  Switch,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { ArrowLeft, Heart, MessageCircle, PlayCircle, Share2 } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError, apiAuthed } from "@/lib/api";
import { createBooking, listSlots, type Slot } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";
import type { Paginated } from "@/lib/teachers";
import { getTeacher, type Offering, type TeacherDetail as Teacher } from "@/lib/teachers";
import { DetailRow } from "@/components/ui";

type Dict = Dictionary["browse"];

const { Paragraph, Text } = Typography;

interface ReviewRow {
  id: number;
  student_name: string;
  rating: number;
  text: string;
  created_at: string;
}

export default function TeacherDetail({
  id,
  dict,
  locale,
}: {
  id: number;
  dict: Dict;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const { message } = App.useApp();
  const { user } = useAuth();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [booking, setBooking] = useState<Offering | null>(null);
  const [messaging, setMessaging] = useState(false);
  const [isFav, setIsFav] = useState(false);

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

  function onBook(offering: Offering) {
    if (!user) return void router.push(signInHref);
    setBooking(offering);
  }

  if (loading) return <div className="flex justify-center py-24"><Spin /></div>;
  if (notFound || !teacher) {
    return (
      <section className="flex flex-col items-center gap-4 py-20">
        <Text type="secondary">{dict.notFound}</Text>
        <Link href={`/${locale}/teachers`} className="btn btn-ghost">{dict.backToList}</Link>
      </section>
    );
  }

  const bio = (ar ? teacher.bio_ar : teacher.bio_en) || teacher.bio_en || teacher.bio_ar;

  return (
    <section className="flex flex-col gap-6">
      <Link href={`/${locale}/teachers`} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        <ArrowLeft size={15} className="rtl:-scale-x-100" />
        {dict.backToList}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="flex flex-col gap-6">
          {/* Hero */}
          <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <Avatar size={88} src={teacher.photo_url ?? undefined} style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700, fontSize: 32 }}>
              {(teacher.full_name || "?").trim().charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex flex-1 flex-col gap-2">
              <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                {teacher.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <Rate disabled allowHalf value={Number(teacher.rating_avg)} style={{ fontSize: 15 }} />
                <Text type="secondary">
                  {Number(teacher.rating_avg).toFixed(1)} · {teacher.rating_count} · {teacher.lessons_count} {dict.lessons}
                </Text>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {teacher.languages.filter(Boolean).map((l) => (
                  <Tag key={l} bordered={false} style={{ background: "var(--surface-2)" }}>{l}</Tag>
                ))}
                {teacher.free_lessons_offered > 0 && (
                  <Tag color="green" bordered={false}>
                    {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
                  </Tag>
                )}
              </div>
              {canAct && (
                <div className="mt-1 flex flex-wrap gap-2">
                  <Button
                    icon={<Heart size={15} fill={isFav ? "currentColor" : "none"} />}
                    onClick={onToggleFav}
                    style={isFav ? { color: "var(--brand)", borderColor: "var(--brand)" } : undefined}
                  >
                    {isFav ? dict.saved : dict.save}
                  </Button>
                  <Button icon={<MessageCircle size={15} />} loading={messaging} onClick={onMessage}>
                    {dict.message}
                  </Button>
                  <Button icon={<Share2 size={15} />} onClick={onShare}>{dict.share}</Button>
                </div>
              )}
            </div>
          </div>

          {teacher.intro_video_url && (
            <a href={teacher.intro_video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
              <PlayCircle size={18} />
              {dict.introVideo}
            </a>
          )}

          <Tabs
            items={[
              {
                key: "about",
                label: dict.bio,
                children: bio ? (
                  <Paragraph style={{ color: "var(--ink-muted)", whiteSpace: "pre-line" }}>{bio}</Paragraph>
                ) : (
                  <Text type="secondary">—</Text>
                ),
              },
              {
                key: "availability",
                label: dict.availability,
                children: <AvailabilityGrid teacher={teacher} dict={dict} />,
              },
              {
                key: "reviews",
                label: `${dict.reviews} (${teacher.reviews_summary.rating_count})`,
                children: <ReviewsTab teacherId={id} locale={locale} dict={dict} seed={teacher.recent_reviews} />,
              },
            ]}
          />
        </div>

        {/* Sticky booking panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="surface p-5">
            <h2 className="mb-4 text-base font-semibold" style={{ color: "var(--ink)" }}>{dict.bookPanel}</h2>
            <div className="flex flex-col gap-3">
              {teacher.offerings.map((o) => (
                <div key={o.lesson_category_id} className="flex flex-col gap-2 rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                  <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    {[o.vertical, o.grade_level, o.subject].filter(Boolean).join(" · ")}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: "var(--ink-muted)" }}>{o.price.display}</span>
                    {canAct && (
                      <Button type="primary" size="small" onClick={() => onBook(o)}>
                        {user ? dict.book : dict.signInToBook}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {booking && (
        <BookingModal
          teacherId={teacher.id}
          offering={booking}
          freeLessonsOffered={teacher.free_lessons_offered}
          dict={dict}
          locale={locale}
          onClose={() => setBooking(null)}
        />
      )}
    </section>
  );
}

function AvailabilityGrid({ teacher, dict }: { teacher: Teacher; dict: Dict }) {
  if (teacher.availability.length === 0) return <Text type="secondary">—</Text>;
  const byDay: Record<number, string[]> = {};
  for (const a of teacher.availability) {
    (byDay[a.weekday] ??= []).push(`${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`);
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {dict.weekdays.map((label, wd) => (
        <div key={wd} className="rounded-xl p-3 text-center" style={{ border: "1px solid var(--border)" }}>
          <div className="mb-2 text-xs font-semibold" style={{ color: "var(--ink)" }}>{label}</div>
          <div className="flex flex-col gap-1">
            {(byDay[wd] ?? []).length === 0 ? (
              <span className="text-xs" style={{ color: "var(--ink-faint)" }}>—</span>
            ) : (
              byDay[wd].map((r, i) => (
                <span key={i} className="text-xs" style={{ color: "var(--ink-muted)" }} dir="ltr">{r}</span>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab({
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

  if (reviews.length === 0) return <Text type="secondary">{dict.noReviews}</Text>;

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="surface p-4">
          <div className="flex items-center gap-2">
            <Rate disabled value={r.rating} style={{ fontSize: 13 }} />
            <Text type="secondary" className="text-sm">{r.student_name}</Text>
          </div>
          {r.text && <Paragraph style={{ marginBottom: 0, marginTop: 6 }}>{r.text}</Paragraph>}
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {new Date(r.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
          </span>
        </div>
      ))}
      {hasNext && (
        <Button loading={loading} onClick={loadMore} className="self-start">{dict.loadMore}</Button>
      )}
    </div>
  );
}

function BookingModal({
  teacherId,
  offering,
  freeLessonsOffered,
  dict,
  locale,
  onClose,
}: {
  teacherId: number;
  offering: Offering;
  freeLessonsOffered: number;
  dict: Dict;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [start, setStart] = useState<string | undefined>();
  const [isTrial, setIsTrial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lowFunds, setLowFunds] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingSlots(true);
    listSlots(teacherId)
      .then((s) => active && setSlots(s))
      .catch(() => active && setSlots([]))
      .finally(() => active && setLoadingSlots(false));
    return () => {
      active = false;
    };
  }, [teacherId]);

  const dayFmt = useCallback(
    (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" }),
    [locale],
  );
  const timeFmt = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(locale, { timeStyle: "short" }),
    [locale],
  );
  const groups = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    (acc[dayFmt(s.start)] ??= []).push(s);
    return acc;
  }, {});
  const options = Object.entries(groups).map(([label, items]) => ({
    label,
    options: items.map((s) => ({ label: timeFmt(s.start), value: s.start })),
  }));

  async function submit() {
    if (!start) return;
    setSubmitting(true);
    setLowFunds(false);
    try {
      await createBooking({
        teacher: teacherId,
        lesson_category: offering.lesson_category_id,
        scheduled_start: start,
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

  const priceText = isTrial ? dict.free : offering.price.display;

  return (
    <Modal
      open
      onCancel={onClose}
      title={`${dict.bookTitle} · ${offering.subject}`}
      okText={dict.confirm}
      okButtonProps={{ disabled: !start, loading: submitting }}
      onOk={submit}
    >
      <div className="flex flex-col gap-4 py-2">
        {loadingSlots ? (
          <div className="flex justify-center py-6"><Spin /></div>
        ) : slots.length === 0 ? (
          <Alert type="info" message={dict.noSlots} showIcon />
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.chooseTime}</span>
            <Select value={start} onChange={setStart} placeholder={dict.chooseTime} options={options} style={{ width: "100%" }} />
          </label>
        )}
        {freeLessonsOffered > 0 && (
          <label className="flex items-center gap-3">
            <Switch checked={isTrial} onChange={setIsTrial} />
            <span className="text-sm" style={{ color: "var(--ink)" }}>{dict.trialToggle}</span>
          </label>
        )}
        <DetailRow label={dict.priceLabel} value={<strong>{priceText}</strong>} />
        {lowFunds && (
          <Alert
            type="warning"
            showIcon
            message={dict.errFunds}
            action={
              <Link href={`/${locale}/wallet`} className="font-semibold" style={{ color: "var(--brand)" }}>
                {dict.topUp}
              </Link>
            }
          />
        )}
      </div>
    </Modal>
  );
}
