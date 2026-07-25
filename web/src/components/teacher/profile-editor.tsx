"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tag,
  TimePicker,
  Typography,
} from "antd";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import {
  teacherSelf,
  type AvailabilityRule,
  type LessonCategoryOption,
  type PriceRequest,
  type TeacherProfile,
  type TeacherSubject,
} from "@/lib/teacher-self";

type Dict = Dictionary["teacherProfile"];

const { Title, Paragraph, Text } = Typography;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return m ? m[1] : null;
}

export default function ProfileEditor({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const label = useCallback(
    (c: LessonCategoryOption) => (ar ? c.label_ar : c.label),
    [ar],
  );

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [categories, setCategories] = useState<LessonCategoryOption[]>([]);
  const [subjects, setSubjects] = useState<TeacherSubject[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRule[]>([]);
  const [prices, setPrices] = useState<PriceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      teacherSelf.getProfile(),
      teacherSelf.listCategories(),
      teacherSelf.listSubjects(),
      teacherSelf.listAvailability(),
      teacherSelf.listPrices(),
    ])
      .then(([p, c, s, a, pr]) => {
        setProfile(p);
        setCategories(c);
        setSubjects(s);
        setAvailability(a);
        setPrices(pr);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  const fail = useCallback(
    (err: unknown) => message.error(err instanceof ApiError ? err.message : dict.actionError),
    [message, dict.actionError],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    );
  }
  if (error || !profile) {
    return <Alert type="error" message={error ?? dict.loadError} showIcon />;
  }

  const usedCategoryIds = new Set(subjects.map((s) => s.lesson_category.id));
  const addableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));

  async function saveProfile(values: Record<string, unknown>) {
    try {
      const patch = {
        ...values,
        languages: Array.isArray(values.languages)
          ? (values.languages as string[]).join(",")
          : profile!.languages,
      };
      const updated = await teacherSelf.updateProfile(patch as Partial<TeacherProfile>);
      setProfile(updated);
      message.success(dict.saved);
    } catch (err) {
      fail(err);
    }
  }

  async function togglePublish() {
    try {
      setMissing([]);
      const updated = profile!.is_published
        ? await teacherSelf.unpublish()
        : await teacherSelf.publish();
      setProfile(updated);
      message.success(updated.is_published ? dict.publishSuccess : dict.unpublishSuccess);
    } catch (err) {
      if (err instanceof ApiError && err.code === "profile_incomplete") {
        const detail = err.detail as { missing?: string[] } | undefined;
        setMissing(detail?.missing ?? []);
      } else {
        fail(err);
      }
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            {dict.title}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {dict.intro}
          </Paragraph>
        </div>
        <Space direction="vertical" align="end">
          <Tag color={profile.is_published ? "green" : "gold"}>
            {profile.is_published ? dict.statusPublished : dict.statusDraft}
          </Tag>
          <Button
            type={profile.is_published ? "default" : "primary"}
            onClick={togglePublish}
          >
            {profile.is_published ? dict.unpublish : dict.publish}
          </Button>
        </Space>
      </div>

      {missing.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={dict.incomplete}
          description={
            <ul style={{ margin: 0, paddingInlineStart: 18 }}>
              {missing.includes("subject") && <li>{dict.missingSubject}</li>}
              {missing.includes("bio") && <li>{dict.missingBio}</li>}
            </ul>
          }
        />
      )}

      <Card title={dict.profileSection}>
        <ProfileForm dict={dict} profile={profile} onSave={saveProfile} />
      </Card>

      <SubjectsCard
        dict={dict}
        label={label}
        subjects={subjects}
        addable={addableCategories}
        onAdd={async (catId) => {
          try {
            const created = await teacherSelf.addSubject(catId);
            setSubjects((prev) => [...prev, created]);
          } catch (err) {
            fail(err);
          }
        }}
        onRemove={async (id) => {
          try {
            await teacherSelf.removeSubject(id);
            setSubjects((prev) => prev.filter((s) => s.id !== id));
          } catch (err) {
            fail(err);
          }
        }}
      />

      <AvailabilityCard
        dict={dict}
        availability={availability}
        onAdd={async (body) => {
          try {
            const created = await teacherSelf.addAvailability(body);
            setAvailability((prev) => [...prev, created]);
          } catch (err) {
            fail(err);
          }
        }}
        onRemove={async (id) => {
          try {
            await teacherSelf.removeAvailability(id);
            setAvailability((prev) => prev.filter((a) => a.id !== id));
          } catch (err) {
            fail(err);
          }
        }}
      />

      <PricesCard
        dict={dict}
        label={label}
        categories={categories}
        prices={prices}
        onRequest={async (catId, amount) => {
          try {
            await teacherSelf.requestPrice(catId, amount);
            setPrices(await teacherSelf.listPrices());
          } catch (err) {
            fail(err);
          }
        }}
        onRemove={async (id) => {
          try {
            await teacherSelf.removePrice(id);
            setPrices((prev) => prev.filter((p) => p.id !== id));
          } catch (err) {
            fail(err);
          }
        }}
      />
    </section>
  );
}

function ProfileForm({
  dict,
  profile,
  onSave,
}: {
  dict: Dict;
  profile: TeacherProfile;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [videoUrl, setVideoUrl] = useState(profile.intro_video_url);
  const vid = youtubeId(videoUrl);

  const initial = {
    full_name: profile.full_name,
    gender: profile.gender || undefined,
    languages: profile.languages ? profile.languages.split(",").filter(Boolean) : [],
    bio_en: profile.bio_en,
    bio_ar: profile.bio_ar,
    intro_video_url: profile.intro_video_url,
    free_lessons_offered: profile.free_lessons_offered,
  };

  return (
    <Form
      layout="vertical"
      initialValues={initial}
      requiredMark={false}
      onValuesChange={(changed) => {
        if ("intro_video_url" in changed) setVideoUrl(changed.intro_video_url ?? "");
      }}
      onFinish={async (values) => {
        setSaving(true);
        await onSave(values);
        setSaving(false);
      }}
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="full_name" label={dict.fullName}>
          <Input />
        </Form.Item>
        <Form.Item name="gender" label={dict.gender}>
          <Select
            allowClear
            options={[
              { value: "MALE", label: dict.male },
              { value: "FEMALE", label: dict.female },
            ]}
          />
        </Form.Item>
        <Form.Item name="languages" label={dict.languages}>
          <Select
            mode="multiple"
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </Form.Item>
        <Form.Item name="free_lessons_offered" label={dict.freeLessons}>
          <InputNumber min={0} max={10} style={{ width: "100%" }} />
        </Form.Item>
      </div>
      <Form.Item name="bio_en" label={dict.bioEn}>
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="bio_ar" label={dict.bioAr}>
        <Input.TextArea rows={3} dir="rtl" />
      </Form.Item>
      <Form.Item name="intro_video_url" label={dict.introVideoUrl}>
        <Input placeholder="https://youtu.be/..." inputMode="url" />
      </Form.Item>
      {vid && (
        <div className="mb-4">
          <Text type="secondary">{dict.videoPreview}</Text>
          <div className="mt-2 aspect-video max-w-md overflow-hidden rounded-lg">
            <iframe
              src={`https://www.youtube.com/embed/${vid}`}
              title="intro"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>
      )}
      <Button type="primary" htmlType="submit" loading={saving}>
        {dict.save}
      </Button>
    </Form>
  );
}

function SubjectsCard({
  dict,
  label,
  subjects,
  addable,
  onAdd,
  onRemove,
}: {
  dict: Dict;
  label: (c: LessonCategoryOption) => string;
  subjects: TeacherSubject[];
  addable: LessonCategoryOption[];
  onAdd: (categoryId: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number | undefined>();

  return (
    <Card title={dict.subjectsSection}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {subjects.length === 0 ? (
          <Text type="secondary">{dict.noSubjects}</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span>
                  {label(s.lesson_category)}{" "}
                  <Text type="secondary">— {s.effective_price.display}</Text>
                  {s.effective_price.is_custom && <Tag color="blue" className="ms-2">★</Tag>}
                </span>
                <Button size="small" danger onClick={() => onRemove(s.id)}>
                  {dict.remove}
                </Button>
              </div>
            ))}
          </Space>
        )}
        <Space.Compact style={{ width: "100%", maxWidth: 480 }}>
          <Select
            style={{ width: "100%" }}
            placeholder={dict.subjectPlaceholder}
            value={selected}
            onChange={setSelected}
            options={addable.map((c) => ({ value: c.id, label: label(c) }))}
          />
          <Button
            type="primary"
            disabled={!selected}
            onClick={async () => {
              if (selected) {
                await onAdd(selected);
                setSelected(undefined);
              }
            }}
          >
            {dict.addSubject}
          </Button>
        </Space.Compact>
      </Space>
    </Card>
  );
}

function AvailabilityCard({
  dict,
  availability,
  onAdd,
  onRemove,
}: {
  dict: Dict;
  availability: AvailabilityRule[];
  onAdd: (body: Omit<AvailabilityRule, "id">) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [weekday, setWeekday] = useState(0);
  const [start, setStart] = useState<dayjs.Dayjs | null>(null);
  const [end, setEnd] = useState<dayjs.Dayjs | null>(null);

  return (
    <Card title={dict.availabilitySection}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {availability.length === 0 ? (
          <Text type="secondary">{dict.noAvailability}</Text>
        ) : (
          <Space size={[8, 8]} wrap>
            {availability.map((a) => (
              <Tag key={a.id} closable onClose={() => onRemove(a.id)}>
                {dict.weekdays[a.weekday]} {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
              </Tag>
            ))}
          </Space>
        )}
        <Space wrap>
          <Select
            value={weekday}
            onChange={setWeekday}
            style={{ width: 130 }}
            options={dict.weekdays.map((d, i) => ({ value: i, label: d }))}
          />
          <TimePicker value={start} onChange={setStart} format="HH:mm" minuteStep={15} placeholder={dict.startTime} />
          <TimePicker value={end} onChange={setEnd} format="HH:mm" minuteStep={15} placeholder={dict.endTime} />
          <Button
            type="primary"
            disabled={!start || !end}
            onClick={async () => {
              if (start && end) {
                await onAdd({
                  weekday,
                  start_time: start.format("HH:mm"),
                  end_time: end.format("HH:mm"),
                });
                setStart(null);
                setEnd(null);
              }
            }}
          >
            {dict.addAvailability}
          </Button>
        </Space>
      </Space>
    </Card>
  );
}

function PricesCard({
  dict,
  label,
  categories,
  prices,
  onRequest,
  onRemove,
}: {
  dict: Dict;
  label: (c: LessonCategoryOption) => string;
  categories: LessonCategoryOption[];
  prices: PriceRequest[];
  onRequest: (categoryId: number, amount: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [category, setCategory] = useState<number | undefined>();
  const [amount, setAmount] = useState<number | null>(null);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <Card title={dict.pricesSection}>
      <Paragraph type="secondary">{dict.pricesHint}</Paragraph>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {prices.length === 0 ? (
          <Text type="secondary">{dict.noPrices}</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {prices.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <span>
                  {label(p.lesson_category)} —{" "}
                  {(p.custom_student_price_minor / 100).toFixed(2)} {p.lesson_category.currency}{" "}
                  <Tag color={p.is_approved ? "green" : "gold"} className="ms-1">
                    {p.is_approved ? dict.approved : dict.pending}
                  </Tag>
                </span>
                <Button size="small" danger onClick={() => onRemove(p.id)}>
                  {dict.remove}
                </Button>
              </div>
            ))}
          </Space>
        )}
        <Space wrap>
          <Select
            style={{ width: 240 }}
            placeholder={dict.subjectPlaceholder}
            value={category}
            onChange={setCategory}
            options={categories.map((c) => ({ value: c.id, label: label(c) }))}
          />
          <InputNumber
            style={{ width: 200 }}
            min={1}
            placeholder={dict.requestedPrice}
            value={amount}
            onChange={setAmount}
            addonAfter={category ? byId.get(category)?.currency : undefined}
          />
          <Button
            type="primary"
            disabled={!category || !amount}
            onClick={async () => {
              if (category && amount) {
                await onRequest(category, amount);
                setCategory(undefined);
                setAmount(null);
              }
            }}
          >
            {dict.requestPrice}
          </Button>
        </Space>
      </Space>
    </Card>
  );
}
