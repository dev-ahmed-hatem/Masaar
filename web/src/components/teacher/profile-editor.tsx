"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import type { StageCard } from "@/lib/stage-cards";
import { teacherSelf, type TeacherProfile } from "@/lib/teacher-self";

import GoogleCalendarCard from "@/components/integrations/google-calendar-card";
import StageCardsEditor from "@/components/teaching/stage-cards-editor";

type Dict = Dictionary["teacherProfile"];
type GcalDict = Dictionary["googleCalendar"];
type CardsDict = Dictionary["stageCards"];

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
  cards: cardsDict,
  gcal,
  locale,
}: {
  dict: Dict;
  cards: CardsDict;
  gcal: GcalDict;
  locale: Locale;
}) {
  const { message } = App.useApp();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [stages, setStages] = useState<StageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [incompleteStages, setIncompleteStages] = useState<number[]>([]);

  useEffect(() => {
    Promise.all([teacherSelf.getProfile(), teacherSelf.listStages()])
      .then(([p, cards]) => {
        setProfile(p);
        setStages(cards);
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
      setIncompleteStages([]);
      const updated = profile!.is_published
        ? await teacherSelf.unpublish()
        : await teacherSelf.publish();
      setProfile(updated);
      message.success(updated.is_published ? dict.publishSuccess : dict.unpublishSuccess);
    } catch (err) {
      if (err instanceof ApiError && err.code === "profile_incomplete") {
        const detail = err.detail as { missing?: string[]; incomplete_stages?: number[] } | undefined;
        setMissing(detail?.missing ?? []);
        setIncompleteStages(detail?.incomplete_stages ?? []);
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
              {missing.includes("bio") && <li>{dict.missingBio}</li>}
              {missing.includes("stage") && <li>{dict.missingStage}</li>}
              {missing.includes("subject") && <li>{dict.missingSubject}</li>}
              {missing.includes("price") && <li>{dict.missingPrice}</li>}
              {missing.includes("availability") && <li>{dict.missingAvailability}</li>}
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

      <Section title={dict.stagesSection}>
        <Paragraph type="secondary">{dict.stagesHint}</Paragraph>
        <StageCardsEditor
          dict={cardsDict}
          locale={locale}
          market={profile.market}
          cards={stages}
          highlightIds={incompleteStages}
          onSave={async (input, _preview, existing) => {
            try {
              const saved = existing
                ? await teacherSelf.updateStage(existing.id, input)
                : await teacherSelf.createStage(input);
              setStages((prev) =>
                existing ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved],
              );
              setIncompleteStages((ids) => ids.filter((id) => id !== saved.id));
              message.success(dict.stageSaved);
            } catch (err) {
              fail(err);
              throw err; // keep the dialog open
            }
          }}
          onRemove={async (card) => {
            try {
              await teacherSelf.deleteStage(card.id);
              setStages((prev) => prev.filter((c) => c.id !== card.id));
              message.success(dict.stageRemoved);
            } catch (err) {
              if (err instanceof ApiError && err.code === "stage_in_use") message.error(cardsDict.stageInUse);
              else fail(err);
            }
          }}
        />
      </Section>

      <GoogleCalendarCard dict={gcal} locale={locale} />

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
          <Select mode="multiple" options={LANGUAGE_OPTIONS.map(({ value, label }) => ({ value, label }))} />
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
