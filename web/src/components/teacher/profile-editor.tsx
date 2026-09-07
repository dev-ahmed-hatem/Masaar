"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Alert,
  App,
  Button,
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
import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import {
  teacherSelf,
  type AvailabilityRule,
  type LessonCategoryOption,
  type TeacherProfile,
  type TeacherSpecialization,
  type TeacherStagePrice,
  type TeacherSubject,
} from "@/lib/teacher-self";
import {
  catalog,
  catalogName,
  type Stage,
  type StagePricing,
  type StageSubject,
  type Track as CatalogTrack,
} from "@/lib/catalog";

import GoogleCalendarCard from "@/components/integrations/google-calendar-card";

type Dict = Dictionary["teacherProfile"];
type GcalDict = Dictionary["googleCalendar"];

const { Paragraph, Text } = Typography;

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return m ? m[1] : null;
}

/** Lightweight profile-builder section (replaces the heavy antd Card stack). */
function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="surface p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function ProfileEditor({
  dict,
  gcal,
  locale,
}: {
  dict: Dict;
  gcal: GcalDict;
  locale: Locale;
}) {
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
  const [stagePrices, setStagePrices] = useState<TeacherStagePrice[]>([]);
  const [stageRules, setStageRules] = useState<StagePricing[]>([]);
  const [specializations, setSpecializations] = useState<TeacherSpecialization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      teacherSelf.getProfile(),
      teacherSelf.listCategories(),
      teacherSelf.listSubjects(),
      teacherSelf.listAvailability(),
      teacherSelf.listStagePrices(),
      teacherSelf.listSpecializations(),
    ])
      .then(([p, c, s, a, sp, spec]) => {
        setProfile(p);
        setCategories(c);
        setSubjects(s);
        setAvailability(a);
        setStagePrices(sp);
        setSpecializations(spec);
        catalog.listStagePricing(p.market).then(setStageRules).catch(() => setStageRules([]));
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
    <section className="flex flex-col gap-6 pb-20 lg:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {dict.title}
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>{dict.intro}</p>
        </div>
        <Tag color={profile.is_published ? "green" : "gold"} bordered={false} style={{ borderRadius: 999, fontWeight: 600 }}>
          {profile.is_published ? dict.statusPublished : dict.statusDraft}
        </Tag>
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
              {missing.includes("price") && <li>{dict.missingPrice}</li>}
            </ul>
          }
        />
      )}

      <Section title={dict.photoSection}>
        <PhotoSection
          dict={dict}
          profile={profile}
          onChange={(updated) => setProfile(updated)}
        />
      </Section>

      <Section title={dict.profileSection}>
        <ProfileForm dict={dict} profile={profile} onSave={saveProfile} />
      </Section>

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

      <SpecializationsCard
        dict={dict}
        locale={locale}
        specializations={specializations}
        onAdd={async (body) => {
          try {
            const created = await teacherSelf.addSpecialization(body);
            setSpecializations((prev) => [...prev, created]);
          } catch (err) {
            fail(err);
          }
        }}
        onRemove={async (id) => {
          try {
            await teacherSelf.removeSpecialization(id);
            setSpecializations((prev) => prev.filter((s) => s.id !== id));
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

      <GoogleCalendarCard dict={gcal} locale={locale} />

      <StagePricesCard
        dict={dict}
        locale={locale}
        subjects={subjects}
        stagePrices={stagePrices}
        stageRules={stageRules}
        onSave={async (vertical, price_minor) => {
          try {
            const saved = await teacherSelf.setStagePrice(vertical, price_minor);
            setStagePrices((prev) => [...prev.filter((p) => p.vertical !== vertical), saved]);
            message.success(dict.saved);
          } catch (err) {
            fail(err);
          }
        }}
      />

      {/* Sticky publish bar — clears above the mobile tab bar. */}
      <div
        className="glass fixed inset-x-0 bottom-16 z-20 flex items-center justify-between gap-3 border-t px-4 py-3 lg:static lg:bottom-auto lg:rounded-2xl lg:border"
        style={{ borderColor: "var(--border)", paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {profile.is_published ? dict.publishedHint : dict.draftHint}
        </span>
        <Button type={profile.is_published ? "default" : "primary"} onClick={togglePublish}>
          {profile.is_published ? dict.unpublish : dict.publish}
        </Button>
      </div>
    </section>
  );
}

function PhotoSection({
  dict,
  profile,
  onChange,
}: {
  dict: Dict;
  profile: TeacherProfile;
  onChange: (profile: TeacherProfile) => void;
}) {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      onChange(await teacherSelf.uploadPhoto(file));
      message.success(dict.photoUpdated);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      onChange(await teacherSelf.removePhoto());
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.actionError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {profile.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photo_url}
          alt={profile.full_name}
          className="h-24 w-24 rounded-full object-cover"
          style={{ border: "2px solid var(--border)" }}
        />
      ) : (
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold"
          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
        >
          {(profile.full_name || "?").trim().charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex flex-col gap-2">
        <Text type="secondary">{dict.photoHint}</Text>
        <Space>
          <label className="btn btn-primary" style={{ cursor: "pointer" }}>
            {busy ? "…" : profile.photo_url ? dict.photoReplace : dict.photoUpload}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
          </label>
          {profile.photo_url ? (
            <Button danger onClick={remove} disabled={busy}>
              {dict.photoRemove}
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
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
    specialties: profile.specialties ?? [],
    education: profile.education ?? [],
    work_experience: profile.work_experience ?? [],
    certifications: profile.certifications ?? [],
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
        <Form.Item name="full_name" label={dict.fullName} rules={[{ required: true, whitespace: true }]}>
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
      <Form.Item name="specialties" label={dict.specialties} help={dict.specialtiesHint}>
        <Select mode="tags" tokenSeparators={[","]} open={false} suffixIcon={null} />
      </Form.Item>

      <ResumeListField
        listName="education"
        title={dict.educationSection}
        addLabel={dict.addEducation}
        removeLabel={dict.remove}
        fields={[
          { name: "degree", label: dict.degree },
          { name: "institution", label: dict.institution },
          { name: "start_year", label: dict.startYear },
          { name: "end_year", label: dict.endYear },
          { name: "description", label: dict.description, area: true },
        ]}
      />

      <ResumeListField
        listName="work_experience"
        title={dict.experienceSection}
        addLabel={dict.addExperience}
        removeLabel={dict.remove}
        fields={[
          { name: "title", label: dict.jobTitle },
          { name: "organization", label: dict.organization },
          { name: "start_year", label: dict.startYear },
          { name: "end_year", label: dict.endYear },
          { name: "description", label: dict.description, area: true },
        ]}
      />

      <ResumeListField
        listName="certifications"
        title={dict.certificationsSection}
        addLabel={dict.addCertification}
        removeLabel={dict.remove}
        fields={[
          { name: "name", label: dict.certName },
          { name: "issuer", label: dict.issuer },
          { name: "year", label: dict.year },
          { name: "description", label: dict.description, area: true },
        ]}
      />

      <Button type="primary" htmlType="submit" loading={saving}>
        {dict.save}
      </Button>
    </Form>
  );
}

function ResumeListField({
  listName,
  title,
  addLabel,
  removeLabel,
  fields,
}: {
  listName: string;
  title: string;
  addLabel: string;
  removeLabel: string;
  fields: { name: string; label: string; area?: boolean }[];
}) {
  const rowFields = fields.filter((f) => !f.area);
  const areaFields = fields.filter((f) => f.area);
  return (
    <div className="mb-4">
      <Text strong style={{ color: "var(--ink)" }}>{title}</Text>
      <Form.List name={listName}>
        {(items, { add, remove }) => (
          <div className="mt-2 flex flex-col gap-3">
            {items.map((field) => (
              <div key={field.key} className="rounded-xl p-3" style={{ border: "1px solid var(--border)" }}>
                <div className="grid gap-x-3 sm:grid-cols-2">
                  {rowFields.map((f) => (
                    <Form.Item key={f.name} name={[field.name, f.name]} label={f.label} className="!mb-2">
                      <Input />
                    </Form.Item>
                  ))}
                </div>
                {areaFields.map((f) => (
                  <Form.Item key={f.name} name={[field.name, f.name]} label={f.label} className="!mb-2">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                ))}
                <Button danger size="small" onClick={() => remove(field.name)}>
                  {removeLabel}
                </Button>
              </div>
            ))}
            <Button onClick={() => add()} className="self-start">
              {addLabel}
            </Button>
          </div>
        )}
      </Form.List>
    </div>
  );
}

function SpecializationsCard({
  dict,
  locale,
  specializations,
  onAdd,
  onRemove,
}: {
  dict: Dict;
  locale: Locale;
  specializations: TeacherSpecialization[];
  onAdd: (body: { vertical: number; track: number | null; subject: number }) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageId, setStageId] = useState<number | undefined>();
  const [trackId, setTrackId] = useState<number | null>(null);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [subs, setSubs] = useState<StageSubject[]>([]);
  const [subjectId, setSubjectId] = useState<number | undefined>();

  useEffect(() => {
    catalog.listStages().then(setStages).catch(() => {});
  }, []);

  const stage = stages.find((s) => s.id === stageId);
  const needsTrack = stage != null && stage.child_kind !== "NONE";

  useEffect(() => {
    setTrackId(null);
    setTracks([]);
    setSubs([]);
    setSubjectId(undefined);
    if (!stageId) return;
    if (needsTrack) catalog.listTracks(stageId).then(setTracks).catch(() => {});
    else catalog.listStageSubjects(stageId).then(setSubs).catch(() => {});
  }, [stageId, needsTrack]);

  useEffect(() => {
    setSubjectId(undefined);
    if (stageId && needsTrack && trackId) {
      catalog.listStageSubjects(stageId, trackId).then(setSubs).catch(() => {});
    }
  }, [trackId, stageId, needsTrack]);

  const existing = new Set(
    specializations.map((s) => `${s.vertical}|${s.track ?? 0}|${s.subject}`),
  );
  const addableSubs = subs.filter(
    (ss) => !existing.has(`${stageId}|${(needsTrack ? trackId : null) ?? 0}|${ss.subject}`),
  );
  const canAdd = Boolean(stageId && (!needsTrack || trackId) && subjectId);

  const specLabel = (s: TeacherSpecialization) => {
    const ar = locale === "ar";
    return [
      ar ? s.stage_name_ar : s.stage_name_en,
      s.track_name_en ? (ar ? s.track_name_ar : s.track_name_en) : null,
      ar ? s.subject_name_ar : s.subject_name_en,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <Section title={dict.specializationsSection}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Text type="secondary">{dict.specializationsHint}</Text>

        {specializations.length === 0 ? (
          <Text type="secondary">{dict.noSpecializations}</Text>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {specializations.map((s) => (
              <Tag key={s.id} closable onClose={() => onRemove(s.id)} style={{ marginInlineEnd: 0 }}>
                {specLabel(s)}
              </Tag>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Select
            style={{ minWidth: 170 }}
            placeholder={dict.chooseStage}
            value={stageId}
            onChange={setStageId}
            options={stages.map((st) => ({ value: st.id, label: catalogName(st, locale) }))}
          />
          {needsTrack && (
            <Select
              style={{ minWidth: 170 }}
              placeholder={stage?.child_kind === "FACULTY" ? dict.chooseFaculty : dict.chooseBranch}
              value={trackId ?? undefined}
              onChange={(v) => setTrackId(v)}
              options={tracks.map((t) => ({ value: t.id, label: catalogName(t, locale) }))}
            />
          )}
          <Select
            style={{ minWidth: 190 }}
            showSearch
            optionFilterProp="label"
            placeholder={dict.chooseSubject}
            value={subjectId}
            onChange={setSubjectId}
            disabled={needsTrack && !trackId}
            options={addableSubs.map((ss) => ({
              value: ss.subject,
              label: locale === "ar" ? ss.subject_name_ar : ss.subject_name_en,
            }))}
          />
          <Button
            type="primary"
            disabled={!canAdd}
            onClick={async () => {
              if (!stageId || !subjectId) return;
              await onAdd({ vertical: stageId, track: needsTrack ? trackId : null, subject: subjectId });
              setSubjectId(undefined);
            }}
          >
            {dict.addSpecialization}
          </Button>
        </div>
      </Space>
    </Section>
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
    <Section title={dict.subjectsSection}>
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {subjects.length === 0 ? (
          <Text type="secondary">{dict.noSubjects}</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            {subjects.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span>{label(s.lesson_category)}</span>
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
    </Section>
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
    <Section title={dict.availabilitySection}>
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
    </Section>
  );
}

function StagePricesCard({
  dict,
  locale,
  subjects,
  stagePrices,
  stageRules,
  onSave,
}: {
  dict: Dict;
  locale: Locale;
  subjects: TeacherSubject[];
  stagePrices: TeacherStagePrice[];
  stageRules: StagePricing[];
  onSave: (vertical: number, priceMinor: number) => Promise<void>;
}) {
  const ar = locale === "ar";
  // The distinct stages the teacher teaches (each needs a price to publish).
  const stages = useMemo(() => {
    const seen = new Map<number, TeacherSubject["stage"]>();
    for (const s of subjects) if (!seen.has(s.stage.id)) seen.set(s.stage.id, s.stage);
    return [...seen.values()];
  }, [subjects]);

  const priceByStage = new Map(stagePrices.map((p) => [p.vertical, p]));
  const ruleByStage = new Map(stageRules.map((r) => [r.vertical, r]));

  return (
    <Section title={dict.stagePricesSection}>
      <Paragraph type="secondary">{dict.stagePricesHint}</Paragraph>
      {stages.length === 0 ? (
        <Text type="secondary">{dict.stagePricesEmpty}</Text>
      ) : (
        <div className="flex flex-col gap-3">
          {stages.map((st) => {
            const rule = ruleByStage.get(st.id);
            const existing = priceByStage.get(st.id);
            const min = rule?.min_price_minor ?? existing?.min_price_minor ?? 0;
            return (
              <StageRow
                key={st.id}
                dict={dict}
                name={ar ? st.name_ar : st.name_en}
                min={min}
                currency={rule?.currency ?? ""}
                current={existing?.price_minor ?? null}
                onSave={(minor) => onSave(st.id, minor)}
              />
            );
          })}
        </div>
      )}
    </Section>
  );
}

function StageRow({
  dict,
  name,
  min,
  currency,
  current,
  onSave,
}: {
  dict: Dict;
  name: string;
  min: number;
  currency: string;
  current: number | null;
  onSave: (priceMinor: number) => Promise<void>;
}) {
  const [value, setValue] = useState<number | null>(current != null ? current / 100 : null);
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
      style={{ border: "1px solid var(--border)" }}
    >
      <div className="min-w-0">
        <div className="font-medium" style={{ color: "var(--ink)" }}>{name}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dict.minPriceLabel}: {(min / 100).toFixed(2)} {currency}
        </Text>
      </div>
      <Space>
        <InputNumber
          min={min / 100}
          step={0.5}
          value={value}
          onChange={setValue}
          addonAfter={currency}
          placeholder={dict.yourPrice}
          style={{ width: 160 }}
        />
        <Button
          type="primary"
          loading={saving}
          disabled={value == null}
          onClick={async () => {
            if (value == null) return;
            setSaving(true);
            try {
              await onSave(Math.round(value * 100));
            } finally {
              setSaving(false);
            }
          }}
        >
          {dict.save}
        </Button>
      </Space>
    </div>
  );
}
