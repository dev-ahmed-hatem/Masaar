"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Rate, Spin, Tag } from "antd";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Inbox,
  MessageSquare,
  User,
  Wallet,
  Hourglass,
} from "lucide-react";

import { formatWhen, subjectLabel } from "@/components/bookings/shared";
import { IconChip, StatCard } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { teacherSelf, type TeacherDashboard } from "@/lib/teacher-self";

type Dict = Dictionary["teacherDashboard"];

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default function TeacherDashboardView({
  dict,
  locale,
}: {
  dict: Dict;
  locale: string;
}) {
  const [data, setData] = useState<TeacherDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    teacherSelf
      .dashboard()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError));
  }, [dict.loadError]);

  useEffect(() => load(), [load]);

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={error}
        action={
          <Button size="small" onClick={load}>
            {dict.retry}
          </Button>
        }
      />
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }

  const { profile, earnings, next_lesson } = data;

  const stats: {
    label: string;
    value: React.ReactNode;
    href: string;
    icon: React.ReactNode;
  }[] = [
    {
      label: dict.pendingRequests,
      value: data.pending_requests,
      href: `/${locale}/teacher/lessons`,
      icon: <Inbox size={18} />,
    },
    {
      label: dict.upcoming,
      value: data.upcoming_count,
      href: `/${locale}/teacher/calendar`,
      icon: <CalendarClock size={18} />,
    },
    {
      label: dict.earningsPending,
      value: money(earnings.pending_minor, earnings.currency),
      href: `/${locale}/teacher/earnings`,
      icon: <Hourglass size={18} />,
    },
    {
      label: dict.earningsPaid,
      value: money(earnings.paid_minor, earnings.currency),
      href: `/${locale}/teacher/earnings`,
      icon: <Wallet size={18} />,
    },
  ];

  const quickLinks = [
    { label: dict.linkProfile, href: `/${locale}/teacher/profile`, icon: <User size={18} /> },
    {
      label: dict.linkLessons,
      href: `/${locale}/teacher/lessons`,
      badge: data.pending_requests,
      icon: <Inbox size={18} />,
    },
    { label: dict.linkCalendar, href: `/${locale}/teacher/calendar`, icon: <CalendarDays size={18} /> },
    {
      label: dict.linkMessages,
      href: `/${locale}/teacher/messages`,
      badge: data.unread_messages,
      icon: <MessageSquare size={18} />,
    },
    { label: dict.linkEarnings, href: `/${locale}/teacher/earnings`, icon: <Wallet size={18} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {!profile.is_published && (
        <Alert
          type="warning"
          showIcon
          message={dict.unpublishedTitle}
          description={dict.unpublishedBody}
          action={
            <Link href={`/${locale}/teacher/profile`}>
              <Button size="small" type="primary">
                {dict.completeProfile}
              </Button>
            </Link>
          }
        />
      )}

      <div
        className="mesh-bg surface flex flex-wrap items-center justify-between gap-3 overflow-hidden p-7"
      >
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            {dict.welcome.replace("{name}", profile.full_name || "")}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--ink-muted)" }}>
            <span className="inline-flex items-center gap-1.5">
              <Rate disabled allowHalf value={profile.rating_avg} style={{ fontSize: 14 }} />
              {profile.rating_avg.toFixed(1)} ({profile.rating_count})
            </span>
            <span>·</span>
            <span>{dict.lessonsTaught.replace("{n}", String(profile.lessons_count))}</span>
            {profile.is_published ? (
              <Tag color="green" bordered={false} style={{ borderRadius: 999, fontWeight: 600 }}>
                {dict.published}
              </Tag>
            ) : (
              <Tag bordered={false} style={{ borderRadius: 999, fontWeight: 600 }}>
                {dict.draft}
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, href, icon }) => (
          <Link key={label} href={href} className="block">
            <StatCard label={label} value={value} icon={icon} />
          </Link>
        ))}
      </div>

      <Card title={dict.nextLesson}>
        {next_lesson ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <IconChip size={48}>
                <CalendarClock size={22} />
              </IconChip>
              <div className="flex flex-col gap-1">
                <span className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  {subjectLabel(next_lesson, locale)}
                </span>
                <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {next_lesson.student_name} · {formatWhen(next_lesson.scheduled_start, locale)} ·{" "}
                  {next_lesson.duration_min} {dict.minutes}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              {next_lesson.meeting_link ? (
                <a href={next_lesson.meeting_link} target="_blank" rel="noreferrer">
                  <Button type="primary">{dict.join}</Button>
                </a>
              ) : null}
              <Link href={`/${locale}/teacher/lessons`}>
                <Button>{dict.allLessons}</Button>
              </Link>
            </div>
          </div>
        ) : (
          <span style={{ color: "var(--ink-muted)" }}>{dict.noUpcoming}</span>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {quickLinks.map(({ label, href, badge, icon }) => (
          <Link
            key={href}
            href={href}
            className="surface surface-hover group flex items-center gap-3 p-4"
          >
            <IconChip size={38} variant="soft">
              {icon}
            </IconChip>
            <span className="flex-1 text-sm font-semibold" style={{ color: "var(--ink)" }}>
              {label}
              {badge ? <Badge count={badge} size="small" className="ms-2" /> : null}
            </span>
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
              style={{ color: "var(--brand)" }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
