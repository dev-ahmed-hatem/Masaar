"use client";

import { useCallback, useEffect, useState } from "react";
import { App, Button, DatePicker, Empty, Form, Input, Rate, Select, Spin, Typography } from "antd";
import dayjs from "dayjs";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getStudentProfile, updateMe, updateStudentProfile } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { listGradeLevels, listVerticals, type GradeLevel } from "@/lib/catalog";
import { listMyReviews } from "@/lib/reviews";
import type { Review } from "@/lib/reviews";
import { SegmentedTabs } from "@/components/ui";
import GoogleCalendarCard from "@/components/integrations/google-calendar-card";

type Dict = Dictionary["profile"];
type GcalDict = Dictionary["googleCalendar"];

const { Paragraph, Text } = Typography;

export default function ProfileView({
  dict,
  gcal,
  locale,
}: {
  dict: Dict;
  gcal: GcalDict;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const { user, setUser } = useAuth();
  const { message } = App.useApp();
  const [tab, setTab] = useState("account");

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {dict.title}
        </h1>
        <Paragraph type="secondary" style={{ marginTop: 4 }}>{dict.subtitle}</Paragraph>
      </div>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "account", label: dict.tabAccount },
          { value: "learning", label: dict.tabLearning },
          { value: "security", label: dict.tabSecurity },
          { value: "calendar", label: dict.tabCalendar },
          { value: "reviews", label: dict.tabReviews },
        ]}
      />

      {tab === "account" && <AccountTab dict={dict} user={user} setUser={setUser} message={message} />}
      {tab === "learning" && <LearningTab dict={dict} locale={locale} message={message} />}
      {tab === "security" && <SecurityTab dict={dict} message={message} />}
      {tab === "calendar" && <GoogleCalendarCard dict={gcal} />}
      {tab === "reviews" && <ReviewsTab dict={dict} ar={ar} />}
    </section>
  );
}

type Msg = ReturnType<typeof App.useApp>["message"];

function AccountTab({
  dict,
  user,
  setUser,
  message,
}: {
  dict: Dict;
  user: ReturnType<typeof useAuth>["user"];
  setUser: ReturnType<typeof useAuth>["setUser"];
  message: Msg;
}) {
  const [loading, setLoading] = useState(false);
  if (!user) return null;

  return (
    <div className="surface max-w-lg p-6">
      <Form
        layout="vertical"
        requiredMark={false}
        initialValues={{ full_name: user.full_name, email: user.email, locale: user.locale }}
        onFinish={async (v) => {
          setLoading(true);
          try {
            const updated = await updateMe(v);
            setUser(updated);
            message.success(dict.saved);
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : dict.genericError);
          } finally {
            setLoading(false);
          }
        }}
      >
        <Form.Item name="full_name" label={dict.fullName} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label={dict.email} rules={[{ type: "email" }]}>
          <Input inputMode="email" />
        </Form.Item>
        <Form.Item name="locale" label={dict.language}>
          <Select options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
        </Form.Item>
        <Form.Item label={dict.phone}>
          <Input value={user.phone} disabled />
          <Text type="secondary" className="text-xs">{dict.phoneNote}</Text>
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>{dict.save}</Button>
      </Form>
    </div>
  );
}

function LearningTab({ dict, locale, message }: { dict: Dict; locale: Locale; message: Msg }) {
  const ar = locale === "ar";
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const verticals = await listVerticals();
        const perV = await Promise.all(verticals.map((v) => listGradeLevels(v.id)));
        if (active) setGrades(perV.flat());
        const profile = await getStudentProfile();
        if (active) {
          form.setFieldsValue({
            grade_level: profile.grade_level ?? undefined,
            date_of_birth: profile.date_of_birth ? dayjs(profile.date_of_birth) : undefined,
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [form]);

  if (loading) return <div className="flex justify-center py-10"><Spin /></div>;

  return (
    <div className="surface max-w-lg p-6">
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={async (v) => {
          setSaving(true);
          try {
            await updateStudentProfile({
              grade_level: v.grade_level ?? null,
              date_of_birth: v.date_of_birth ? v.date_of_birth.format("YYYY-MM-DD") : null,
            });
            message.success(dict.saved);
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : dict.genericError);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="grade_level" label={dict.gradeLevel}>
          <Select
            allowClear
            placeholder={dict.selectGrade}
            options={grades.map((g) => ({ value: g.id, label: ar ? g.name_ar : g.name_en }))}
          />
        </Form.Item>
        <Form.Item name="date_of_birth" label={dict.dateOfBirth}>
          <DatePicker style={{ width: "100%" }} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>{dict.save}</Button>
      </Form>
    </div>
  );
}

function SecurityTab({ dict, message }: { dict: Dict; message: Msg }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  return (
    <div className="surface max-w-lg p-6">
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={async (v) => {
          setLoading(true);
          try {
            await authApi.changePassword(v.old_password, v.new_password);
            message.success(dict.passwordChanged);
            form.resetFields();
          } catch (err) {
            message.error(err instanceof ApiError ? err.message : dict.genericError);
          } finally {
            setLoading(false);
          }
        }}
      >
        <Form.Item name="old_password" label={dict.currentPassword} rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item name="new_password" label={dict.newPassword} rules={[{ required: true, min: 8 }]} hasFeedback>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={dict.confirmPassword}
          dependencies={["new_password"]}
          hasFeedback
          rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject(new Error(dict.passwordMismatch));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>{dict.changePassword}</Button>
      </Form>
    </div>
  );
}

function ReviewsTab({ dict, ar }: { dict: Dict; ar: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listMyReviews()
      .then((r) => setReviews(r.results))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  if (loading) return <div className="flex justify-center py-10"><Spin /></div>;
  if (reviews.length === 0) return <Empty description={dict.noReviews} className="py-10" />;

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <div key={r.id} className="surface p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold" style={{ color: "var(--ink)" }}>{r.teacher_name}</span>
            <Rate disabled value={r.rating} style={{ fontSize: 13 }} />
          </div>
          {r.text && <Paragraph style={{ marginBottom: 0, marginTop: 6 }}>{r.text}</Paragraph>}
          <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
            {new Date(r.created_at).toLocaleDateString(ar ? "ar" : "en", { dateStyle: "medium" })}
          </span>
        </div>
      ))}
    </div>
  );
}
