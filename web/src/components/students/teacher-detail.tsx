"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  CalendarDays,
  GraduationCap,
  Heart,
  MessageCircle,
  PlayCircle,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError, apiAuthed } from "@/lib/api";
import { createBooking } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/favorites";
import type { Paginated, Specialization } from "@/lib/teachers";
import { getTeacher, type Offering, type TeacherDetail as Teacher } from "@/lib/teachers";
import { DetailRow } from "@/components/ui";
import TeacherSchedule from "@/components/students/teacher-schedule";

type Dict = Dictionary["browse"];

const { Paragraph, Text } = Typography;

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

interface SpecGroup {
  key: string;
  label: string;
  subjects: { id: number; name: string }[];
}

/** Group specialization tags by stage → (branch/faculty) for the profile. */
function groupSpecializations(specs: Specialization[], ar: boolean): SpecGroup[] {
  const groups = new Map<string, SpecGroup>();
  for (const sp of specs) {
    const key = `${sp.stage.id}:${sp.track?.id ?? 0}`;
    const stageName = ar ? sp.stage.name_ar : sp.stage.name_en;
    const trackName = sp.track ? (ar ? sp.track.name_ar : sp.track.name_en) : "";
    const label = trackName ? `${stageName} · ${trackName}` : stageName;
    let group = groups.get(key);
    if (!group) {
      group = { key, label, subjects: [] };
      groups.set(key, group);
    }
    if (!group.subjects.some((s) => s.id === sp.subject.id)) {
      group.subjects.push({ id: sp.subject.id, name: ar ? sp.subject.name_ar : sp.subject.name_en });
    }
  }
  return [...groups.values()];
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
  const [pickedStart, setPickedStart] = useState<string | null>(null);
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

  function onPickSlot(iso: string) {
    if (!user) return void router.push(signInHref);
    if (!isStudent) return; // teachers/admins can browse but not book
    setPickedStart(iso);
  }

  function scrollToSchedule() {
    document.getElementById(SCHEDULE_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const rating = Number(teacher.rating_avg);
  const topRated = rating >= 4.8 && teacher.rating_count >= 10;
  const videoId = teacher.intro_video_url ? youtubeId(teacher.intro_video_url) : null;

  return (
    <section className="flex flex-col gap-6">
      <Link href={`/${locale}/teachers`} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        <ArrowLeft size={15} className="rtl:-scale-x-100" />
        {dict.backToList}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Hero */}
          <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <Avatar size={96} src={teacher.photo_url ?? undefined} className="shrink-0" style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700, fontSize: 34 }}>
              {(teacher.full_name || "?").trim().charAt(0).toUpperCase()}
            </Avatar>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  {teacher.full_name}
                </h1>
                {topRated && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}>
                    <Star size={12} fill="currentColor" />
                    {dict.topRated}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Rate disabled allowHalf value={rating} style={{ fontSize: 15 }} />
                <Text type="secondary">
                  {rating.toFixed(1)} · {dict.reviewsCount.replace("{n}", String(teacher.rating_count))} · {teacher.lessons_count} {dict.lessons}
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
              <div className="mt-1 flex flex-wrap gap-2">
                {canAct && (
                  <Button
                    icon={<Heart size={15} fill={isFav ? "currentColor" : "none"} />}
                    onClick={onToggleFav}
                    style={isFav ? { color: "var(--brand)", borderColor: "var(--brand)" } : undefined}
                  >
                    {isFav ? dict.saved : dict.save}
                  </Button>
                )}
                <Button icon={<Share2 size={15} />} onClick={onShare}>{dict.share}</Button>
              </div>
            </div>
          </div>

          {/* About */}
          {bio && (
            <Section icon={<BookOpen size={18} />} title={dict.aboutTitle}>
              <Paragraph style={{ color: "var(--ink-muted)", whiteSpace: "pre-line", marginBottom: 0 }}>{bio}</Paragraph>
            </Section>
          )}

          {/* Specialties */}
          {teacher.specialties.length > 0 && (
            <Section icon={<Sparkles size={18} />} title={dict.specialtiesTitle}>
              <div className="flex flex-wrap gap-1.5">
                {teacher.specialties.map((s, i) => (
                  <Tag key={i} bordered={false} style={{ background: "var(--brand-tint)", color: "var(--brand-dark)", margin: 0 }}>
                    {s}
                  </Tag>
                ))}
              </div>
            </Section>
          )}

          {/* Specializations (catalog): grouped stage → branch/faculty → subjects */}
          {teacher.specializations.length > 0 && (
            <Section icon={<GraduationCap size={18} />} title={dict.specializationsTitle}>
              <div className="flex flex-col gap-4">
                {groupSpecializations(teacher.specializations, ar).map((g) => (
                  <div key={g.key} className="flex flex-col gap-2">
                    <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{g.label}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.subjects.map((s) => (
                        <Tag key={s.id} bordered={false} style={{ background: "var(--brand-tint)", color: "var(--brand-dark)", margin: 0 }}>
                          {s.name}
                        </Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Subjects & prices */}
          {teacher.offerings.length > 0 && (
            <Section icon={<GraduationCap size={18} />} title={dict.offerings}>
              <div className="flex flex-col gap-2">
                {teacher.offerings.map((o) => (
                  <div key={o.lesson_category_id} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                    <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                      {[o.vertical, o.grade_level, o.subject].filter(Boolean).join(" · ")}
                    </span>
                    <span className="shrink-0 text-sm font-semibold" style={{ color: "var(--ink)" }}>{o.price.display}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Schedule — the centerpiece */}
          <div id={SCHEDULE_ID} className="surface p-5 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              <CalendarDays size={18} />
              {dict.scheduleTitle}
            </h2>
            <p className="mb-4 text-sm" style={{ color: "var(--ink-muted)" }}>{dict.scheduleIntro}</p>
            <TeacherSchedule
              teacherId={teacher.id}
              locale={locale}
              dict={dict}
              onPick={onPickSlot}
              onMessage={onMessage}
              selected={pickedStart ?? undefined}
            />
          </div>

          {/* Education */}
          {teacher.education.length > 0 && (
            <Section icon={<GraduationCap size={18} />} title={dict.educationTitle}>
              <div className="flex flex-col gap-3">
                {teacher.education.map((e, i) => (
                  <ResumeItem
                    key={i}
                    title={e.degree}
                    subtitle={e.institution}
                    meta={yearRange(e.start_year, e.end_year, dict.present)}
                    description={e.description}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Work experience */}
          {teacher.work_experience.length > 0 && (
            <Section icon={<Briefcase size={18} />} title={dict.experienceTitle}>
              <div className="flex flex-col gap-3">
                {teacher.work_experience.map((e, i) => (
                  <ResumeItem
                    key={i}
                    title={e.title}
                    subtitle={e.organization}
                    meta={yearRange(e.start_year, e.end_year, dict.present)}
                    description={e.description}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Certifications */}
          {teacher.certifications.length > 0 && (
            <Section icon={<Award size={18} />} title={dict.certificationsTitle}>
              <div className="flex flex-col gap-3">
                {teacher.certifications.map((c, i) => (
                  <ResumeItem
                    key={i}
                    title={c.name}
                    subtitle={c.issuer}
                    meta={c.year}
                    description={c.description}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Reviews */}
          <Section icon={<Star size={18} />} title={`${dict.reviews} (${teacher.reviews_summary.rating_count})`}>
            <ReviewsSection teacherId={id} locale={locale} dict={dict} seed={teacher.recent_reviews} />
          </Section>
        </div>

        {/* Sticky booking sidebar */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="surface overflow-hidden">
            {videoId ? (
              <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title={teacher.full_name}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : teacher.intro_video_url ? (
              <a href={teacher.intro_video_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 pt-5 text-sm font-semibold" style={{ color: "var(--brand)" }}>
                <PlayCircle size={18} />
                {dict.introVideo}
              </a>
            ) : null}

            <div className="flex flex-col gap-3 p-5">
              {teacher.from_price && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold" style={{ color: "var(--ink)" }}>{teacher.from_price.display}</span>
                  <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{dict.perLesson}</span>
                </div>
              )}
              {teacher.free_lessons_offered > 0 && (
                <Tag color="green" bordered={false} style={{ width: "fit-content", margin: 0 }}>
                  {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
                </Tag>
              )}
              <Button type="primary" size="large" icon={<CalendarDays size={16} />} onClick={scrollToSchedule}>
                {user ? dict.bookLesson : dict.signInToBook}
              </Button>
              <Button size="large" icon={<MessageCircle size={16} />} loading={messaging} onClick={onMessage}>
                {dict.message}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {pickedStart && (
        <BookingModal
          teacher={teacher}
          startIso={pickedStart}
          dict={dict}
          locale={locale}
          onClose={() => setPickedStart(null)}
        />
      )}
    </section>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
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
    <div className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title || subtitle}</span>
        {meta && <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{meta}</span>}
      </div>
      {title && subtitle && (
        <div className="text-sm" style={{ color: "var(--ink-muted)" }}>{subtitle}</div>
      )}
      {description && (
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)", whiteSpace: "pre-line" }}>{description}</p>
      )}
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

  if (reviews.length === 0) return <Text type="secondary">{dict.noReviews}</Text>;

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl p-4" style={{ border: "1px solid var(--border)" }}>
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
  teacher,
  startIso,
  dict,
  locale,
  onClose,
}: {
  teacher: Teacher;
  startIso: string;
  dict: Dict;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const offerings = teacher.offerings;
  const [offeringId, setOfferingId] = useState<number | undefined>(offerings[0]?.lesson_category_id);
  const [isTrial, setIsTrial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lowFunds, setLowFunds] = useState(false);

  const offering: Offering | undefined =
    offerings.find((o) => o.lesson_category_id === offeringId) ?? offerings[0];

  const whenLabel = new Date(startIso).toLocaleString(locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  async function submit() {
    if (!offering) return;
    setSubmitting(true);
    setLowFunds(false);
    try {
      await createBooking({
        teacher: teacher.id,
        lesson_category: offering.lesson_category_id,
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

  const priceText = isTrial ? dict.free : offering?.price.display ?? "";

  return (
    <Modal
      open
      onCancel={onClose}
      title={dict.bookTitle}
      okText={dict.confirm}
      okButtonProps={{ disabled: !offering, loading: submitting }}
      onOk={submit}
    >
      <div className="flex flex-col gap-4 py-2">
        <DetailRow label={dict.selectedTime} value={<strong dir="ltr">{whenLabel}</strong>} />

        {offerings.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.chooseSubject}</span>
            <Select
              value={offeringId}
              onChange={setOfferingId}
              style={{ width: "100%" }}
              options={offerings.map((o) => ({
                value: o.lesson_category_id,
                label: [o.vertical, o.grade_level, o.subject].filter(Boolean).join(" · "),
              }))}
            />
          </label>
        )}

        {teacher.free_lessons_offered > 0 && (
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
