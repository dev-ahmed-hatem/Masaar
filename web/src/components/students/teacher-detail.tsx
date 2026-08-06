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
  Tag,
  Typography,
} from "antd";
import { ArrowLeft, MessageCircle, PlayCircle } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { createBooking, listSlots, type Slot } from "@/lib/bookings";
import { chatApi } from "@/lib/chat";
import { getTeacher, type Offering, type TeacherDetail as Teacher } from "@/lib/teachers";
import { DetailRow } from "@/components/ui";

type Dict = Dictionary["browse"];

const { Paragraph, Text } = Typography;

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

  // Anonymous visitors and students can act; teachers/staff just view.
  const canAct = !user || user.role === "STUDENT";
  const signInHref = `/${locale}/sign-in`;

  async function onMessage() {
    if (!teacher) return;
    if (!user) {
      router.push(signInHref);
      return;
    }
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

  function onBook(offering: Offering) {
    if (!user) {
      router.push(signInHref);
      return;
    }
    setBooking(offering);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    );
  }
  if (notFound || !teacher) {
    return (
      <section className="flex flex-col items-center gap-4 py-20">
        <Text type="secondary">{dict.notFound}</Text>
        <Link href={`/${locale}/teachers`} className="btn btn-ghost">
          {dict.backToList}
        </Link>
      </section>
    );
  }

  const bio = (ar ? teacher.bio_ar : teacher.bio_en) || teacher.bio_en || teacher.bio_ar;

  return (
    <section className="flex flex-col gap-8">
      <Link
        href={`/${locale}/teachers`}
        className="flex items-center gap-1.5 text-sm font-semibold"
        style={{ color: "var(--ink-muted)" }}
      >
        <ArrowLeft size={15} className="rtl:-scale-x-100" />
        {dict.backToList}
      </Link>

      {/* Hero */}
      <div className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <Avatar
          size={88}
          src={teacher.photo_url ?? undefined}
          style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 700, fontSize: 32 }}
        >
          {(teacher.full_name || "?").trim().charAt(0).toUpperCase()}
        </Avatar>
        <div className="flex flex-1 flex-col gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {teacher.full_name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Rate disabled allowHalf value={Number(teacher.rating_avg)} style={{ fontSize: 15 }} />
            <Text type="secondary">
              {Number(teacher.rating_avg).toFixed(1)} · {teacher.rating_count} · {teacher.lessons_count}{" "}
              {dict.lessons}
            </Text>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teacher.languages.filter(Boolean).map((l) => (
              <Tag key={l} bordered={false} style={{ background: "var(--surface-2)" }}>
                {l}
              </Tag>
            ))}
            {teacher.free_lessons_offered > 0 && (
              <Tag color="green" bordered={false}>
                {dict.freeLessons.replace("{n}", String(teacher.free_lessons_offered))}
              </Tag>
            )}
          </div>
        </div>
        {canAct && (
          <div className="flex gap-2">
            <Button icon={<MessageCircle size={16} />} loading={messaging} onClick={onMessage}>
              {dict.message}
            </Button>
          </div>
        )}
      </div>

      {teacher.intro_video_url && (
        <a
          href={teacher.intro_video_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--brand)" }}
        >
          <PlayCircle size={18} />
          {dict.introVideo}
        </a>
      )}

      {bio && (
        <div>
          <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--ink)" }}>
            {dict.bio}
          </h2>
          <Paragraph style={{ color: "var(--ink-muted)", whiteSpace: "pre-line" }}>{bio}</Paragraph>
        </div>
      )}

      {/* Offerings */}
      <div>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.offerings}
        </h2>
        <div className="flex flex-col gap-3">
          {teacher.offerings.map((o) => (
            <div key={o.lesson_category_id} className="surface flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: "var(--ink)" }}>
                  {[o.vertical, o.grade_level, o.subject].filter(Boolean).join(" · ")}
                </div>
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                  {o.price.display}
                  {o.is_custom_price && <Tag color="blue" bordered={false}>{dict.custom}</Tag>}
                </div>
              </div>
              {canAct && (
                <Button type="primary" onClick={() => onBook(o)}>
                  {user ? dict.book : dict.signInToBook}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Availability */}
      {teacher.availability.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
            {dict.availability}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {teacher.availability.map((a, i) => (
              <Tag key={i} bordered={false} style={{ background: "var(--surface-2)" }}>
                {dict.weekdays[a.weekday]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.reviews} ({teacher.reviews_summary.rating_count})
        </h2>
        {teacher.recent_reviews.length === 0 ? (
          <Text type="secondary">{dict.noReviews}</Text>
        ) : (
          <div className="flex flex-col gap-3">
            {teacher.recent_reviews.map((r, i) => (
              <div key={i} className="surface p-4">
                <div className="flex items-center gap-2">
                  <Rate disabled value={r.rating} style={{ fontSize: 13 }} />
                  <Text type="secondary" className="text-sm">
                    {r.student_name}
                  </Text>
                </div>
                {r.text && <Paragraph style={{ marginBottom: 0, marginTop: 6 }}>{r.text}</Paragraph>}
              </div>
            ))}
          </div>
        )}
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

  // Group slots into AntD option-groups by calendar day.
  const dayFmt = useCallback(
    (iso: string) =>
      new Date(iso).toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" }),
    [locale],
  );
  const timeFmt = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(locale, { timeStyle: "short" }),
    [locale],
  );
  const groups = slots.reduce<Record<string, Slot[]>>((acc, s) => {
    const key = dayFmt(s.start);
    (acc[key] ??= []).push(s);
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
      } else if (code === "market_mismatch") {
        message.error(dict.errMarket);
      } else if (code === "trial_unavailable") {
        message.error(dict.errTrial);
      } else if (code === "slot_unavailable") {
        message.error(dict.errSlot);
      } else {
        message.error(err instanceof ApiError ? err.message : dict.genericError);
      }
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
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        ) : slots.length === 0 ? (
          <Alert type="info" message={dict.noSlots} showIcon />
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
              {dict.chooseTime}
            </span>
            <Select
              value={start}
              onChange={setStart}
              placeholder={dict.chooseTime}
              options={options}
              style={{ width: "100%" }}
            />
          </label>
        )}

        {freeLessonsOffered > 0 && (
          <label className="flex items-center gap-3">
            <Switch checked={isTrial} onChange={setIsTrial} />
            <span className="text-sm" style={{ color: "var(--ink)" }}>
              {dict.trialToggle}
            </span>
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
