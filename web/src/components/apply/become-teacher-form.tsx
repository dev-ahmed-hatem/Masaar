"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Result,
  Select,
  Space,
  Tag,
  TimePicker,
  Typography,
} from "antd";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { submitApplication } from "@/lib/applications";
import {
  catalog,
  catalogName,
  type LessonCategoryOption,
  type Stage,
  type StagePricing,
  type StageSubject,
  type Track as CatalogTrack,
} from "@/lib/catalog";

const { Title, Paragraph, Text } = Typography;

export type ApplyDict = Dictionary["apply"];

interface PickedSubject {
  id: number;
  label: string;
}
interface PickedSpecialization {
  vertical: number;
  track: number | null;
  subject: number;
  label: string;
}
interface PickedAvailability {
  weekday: number;
  start_time: string;
  end_time: string;
}

export default function BecomeTeacherForm({
  dict,
  locale,
}: {
  dict: ApplyDict;
  locale: string;
}) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [market, setMarket] = useState("EG");
  const [categories, setCategories] = useState<LessonCategoryOption[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<PickedSubject[]>([]);
  const [specializations, setSpecializations] = useState<PickedSpecialization[]>([]);
  const [availability, setAvailability] = useState<PickedAvailability[]>([]);
  const [stageRules, setStageRules] = useState<StagePricing[]>([]);
  const [stagePriceByStage, setStagePriceByStage] = useState<Record<number, number>>({});

  // (Re)load the market's lesson categories + stage pricing; a market switch
  // invalidates the subject picks and prices (scoped to one market).
  useEffect(() => {
    let alive = true;
    catalog
      .listLessonCategories(market)
      .then((rows) => {
        if (alive) setCategories(rows);
      })
      .catch(() => {
        if (alive) setCategories([]);
      });
    catalog
      .listStagePricing(market)
      .then((rows) => {
        if (alive) setStageRules(rows);
      })
      .catch(() => {
        if (alive) setStageRules([]);
      });
    setSubjects([]);
    setStagePriceByStage({});
    return () => {
      alive = false;
    };
  }, [market]);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const catLabel = useMemo(
    () => (c: LessonCategoryOption) => (ar ? c.label_ar : c.label),
    [ar],
  );

  // Stages the applicant must price = the distinct stages of their specializations.
  const pricedStages = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; min: number; currency: string }>();
    for (const sp of specializations) {
      if (seen.has(sp.vertical)) continue;
      const rule = stageRules.find((r) => r.vertical === sp.vertical);
      seen.set(sp.vertical, {
        id: sp.vertical,
        name: rule ? (ar ? rule.stage_name_ar : rule.stage_name_en) : sp.label.split(" · ")[0],
        min: rule?.min_price_minor ?? 0,
        currency: rule?.currency ?? "",
      });
    }
    return [...seen.values()];
  }, [specializations, stageRules, ar]);

  async function onFinish(values: Record<string, unknown>) {
    setSubmitting(true);
    try {
      await submitApplication({
        full_name: values.full_name as string,
        phone: values.phone as string,
        email: (values.email as string) || undefined,
        market: values.market as string,
        gender: (values.gender as "MALE" | "FEMALE" | undefined) || "",
        languages: Array.isArray(values.languages)
          ? (values.languages as string[]).join(",")
          : "",
        bio: values.bio as string,
        bio_ar: (values.bio_ar as string) || undefined,
        intro_video_url: (values.intro_video_url as string) || undefined,
        free_lessons_offered: (values.free_lessons_offered as number) ?? 0,
        specialties: (values.specialties as string[]) ?? [],
        education: ((values.education as never[]) ?? []).filter(Boolean),
        work_experience: ((values.work_experience as never[]) ?? []).filter(Boolean),
        certifications: ((values.certifications as never[]) ?? []).filter(Boolean),
        subjects: subjects.map((s) => s.id),
        specializations: specializations.map((s) => ({
          vertical: s.vertical,
          track: s.track,
          subject: s.subject,
        })),
        availability: availability.map((a) => ({
          weekday: a.weekday,
          start_time: a.start_time,
          end_time: a.end_time,
        })),
        stage_prices: pricedStages
          .filter((st) => stagePriceByStage[st.id] != null)
          .map((st) => ({ vertical: st.id, price_minor: stagePriceByStage[st.id] })),
        photo,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_application") {
        message.warning(dict.duplicate);
      } else {
        message.error(err instanceof ApiError ? err.message : dict.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card>
        <Result
          status="success"
          title={dict.successTitle}
          subTitle={dict.successBody}
          extra={
            <Link href={`/${locale}`} className="btn btn-primary">
              {dict.backHome}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div className="text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
        >
          {dict.badge}
        </span>
        <Title level={2} className="!mt-4" style={{ fontFamily: "var(--font-display)" }}>
          {dict.title}
        </Title>
        <Paragraph type="secondary" className="mx-auto max-w-prose text-base">
          {dict.intro}
        </Paragraph>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[dict.step1, dict.step2, dict.step3].map((step, i) => (
          <div key={step} className="surface surface-hover flex items-start gap-3 p-5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
              {step}
            </span>
          </div>
        ))}
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{ market: "EG", free_lessons_offered: 0 }}
        onValuesChange={(changed: { market?: string }) => {
          if (changed.market) setMarket(changed.market);
        }}
      >
        <div className="flex flex-col gap-6">
          <Card title={dict.basicsSection}>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: "EG", label: dict.marketEG },
                    { value: "SA", label: dict.marketSA },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="full_name"
                label={dict.fullName}
                rules={[{ required: true, message: dict.requiredName }]}
              >
                <Input autoComplete="name" />
              </Form.Item>
              <Form.Item
                name="phone"
                label={dict.phone}
                rules={[{ required: true, message: dict.requiredPhone }]}
                extra={dict.phoneHint}
              >
                <Input inputMode="tel" placeholder="01xxxxxxxxx" autoComplete="tel" />
              </Form.Item>
              <Form.Item name="email" label={dict.email} rules={[{ type: "email" }]}>
                <Input inputMode="email" autoComplete="email" />
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
            </div>

            <PhotoField
              dict={dict}
              preview={photoPreview}
              onPick={setPhoto}
              onClear={() => setPhoto(null)}
            />
          </Card>

          <Card title={dict.aboutSection}>
            <Form.Item
              name="bio"
              label={dict.bioEn}
              rules={[{ required: true, message: dict.requiredBio }]}
              extra={dict.bioHint}
            >
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>
            <Form.Item name="bio_ar" label={dict.bioAr}>
              <Input.TextArea rows={4} maxLength={2000} showCount dir="rtl" />
            </Form.Item>
            <Form.Item
              name="intro_video_url"
              label={dict.video}
              extra={dict.videoHint}
              rules={[{ type: "url", message: dict.invalidUrl }]}
            >
              <Input placeholder="https://youtube.com/watch?v=…" />
            </Form.Item>
            <Form.Item name="free_lessons_offered" label={dict.freeLessons} extra={dict.freeLessonsHint}>
              <InputNumber min={0} max={10} style={{ width: "100%" }} />
            </Form.Item>
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
          </Card>

          <Card title={dict.teachingSection}>
            <Paragraph type="secondary">{dict.teachingHint}</Paragraph>
            <SubjectsField
              dict={dict}
              label={catLabel}
              categories={categories}
              picked={subjects}
              onChange={setSubjects}
            />
            <div className="mt-6">
              <SpecializationsField
                dict={dict}
                locale={locale}
                picked={specializations}
                onChange={setSpecializations}
              />
            </div>
            <div className="mt-6">
              <AvailabilityField dict={dict} picked={availability} onChange={setAvailability} />
            </div>
            <div className="mt-6">
              <StagePricesField
                dict={dict}
                stages={pricedStages}
                value={stagePriceByStage}
                onChange={setStagePriceByStage}
              />
            </div>
          </Card>

          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
            {dict.submit}
          </Button>
        </div>
      </Form>
    </div>
  );
}

function PhotoField({
  dict,
  preview,
  onPick,
  onClear,
}: {
  dict: ApplyDict;
  preview: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-24 w-24 rounded-full object-cover"
          style={{ border: "2px solid var(--border)" }}
        />
      ) : (
        <span
          className="flex h-24 w-24 items-center justify-center rounded-full text-2xl"
          style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
        >
          ?
        </span>
      )}
      <div className="flex flex-col gap-2">
        <Text type="secondary">{dict.photoHint}</Text>
        <Space>
          <label className="btn btn-primary" style={{ cursor: "pointer" }}>
            {preview ? dict.photoReplace : dict.photoUpload}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onPick(file);
              }}
            />
          </label>
          {preview ? (
            <Button danger onClick={onClear}>
              {dict.photoRemove}
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
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
      <Text strong style={{ color: "var(--ink)" }}>
        {title}
      </Text>
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

function SubjectsField({
  dict,
  label,
  categories,
  picked,
  onChange,
}: {
  dict: ApplyDict;
  label: (c: LessonCategoryOption) => string;
  categories: LessonCategoryOption[];
  picked: PickedSubject[];
  onChange: (next: PickedSubject[]) => void;
}) {
  const [selected, setSelected] = useState<number | undefined>();
  const pickedIds = new Set(picked.map((p) => p.id));
  const addable = categories.filter((c) => !pickedIds.has(c.id));

  return (
    <div>
      <Text strong style={{ color: "var(--ink)" }}>
        {dict.subjectsSection}
      </Text>
      <div className="mt-2 flex flex-col gap-3">
        {picked.length === 0 ? (
          <Text type="secondary">{dict.noSubjects}</Text>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((s) => (
              <Tag
                key={s.id}
                closable
                onClose={() => onChange(picked.filter((p) => p.id !== s.id))}
                style={{ marginInlineEnd: 0 }}
              >
                {s.label}
              </Tag>
            ))}
          </div>
        )}
        <Space.Compact style={{ width: "100%", maxWidth: 480 }}>
          <Select
            style={{ width: "100%" }}
            showSearch
            optionFilterProp="label"
            placeholder={dict.subjectPlaceholder}
            value={selected}
            onChange={setSelected}
            options={addable.map((c) => ({ value: c.id, label: label(c) }))}
          />
          <Button
            type="primary"
            disabled={!selected}
            onClick={() => {
              const cat = categories.find((c) => c.id === selected);
              if (cat) {
                onChange([...picked, { id: cat.id, label: label(cat) }]);
                setSelected(undefined);
              }
            }}
          >
            {dict.addSubject}
          </Button>
        </Space.Compact>
      </div>
    </div>
  );
}

function SpecializationsField({
  dict,
  locale,
  picked,
  onChange,
}: {
  dict: ApplyDict;
  locale: string;
  picked: PickedSpecialization[];
  onChange: (next: PickedSpecialization[]) => void;
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

  const existing = new Set(picked.map((s) => `${s.vertical}|${s.track ?? 0}|${s.subject}`));
  const track = needsTrack ? trackId : null;
  const addableSubs = subs.filter(
    (ss) => !existing.has(`${stageId}|${track ?? 0}|${ss.subject}`),
  );
  const canAdd = Boolean(stageId && (!needsTrack || trackId) && subjectId);

  function add() {
    if (!stageId || !subjectId || !stage) return;
    const ss = subs.find((s) => s.subject === subjectId);
    const trackRow = tracks.find((t) => t.id === trackId);
    const parts = [
      catalogName(stage, locale),
      trackRow ? catalogName(trackRow, locale) : null,
      ss ? (locale === "ar" ? ss.subject_name_ar : ss.subject_name_en) : null,
    ].filter(Boolean);
    onChange([
      ...picked,
      { vertical: stageId, track, subject: subjectId, label: parts.join(" · ") },
    ]);
    setSubjectId(undefined);
  }

  return (
    <div>
      <Text strong style={{ color: "var(--ink)" }}>
        {dict.specializationsSection}
      </Text>
      <div className="mt-2 flex flex-col gap-3">
        <Text type="secondary">{dict.specializationsHint}</Text>
        {picked.length === 0 ? (
          <Text type="secondary">{dict.noSpecializations}</Text>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {picked.map((s, i) => (
              <Tag
                key={`${s.vertical}|${s.track ?? 0}|${s.subject}`}
                closable
                onClose={() => onChange(picked.filter((_, idx) => idx !== i))}
                style={{ marginInlineEnd: 0 }}
              >
                {s.label}
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
          <Button type="primary" disabled={!canAdd} onClick={add}>
            {dict.addSpecialization}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StagePricesField({
  dict,
  stages,
  value,
  onChange,
}: {
  dict: ApplyDict;
  stages: { id: number; name: string; min: number; currency: string }[];
  value: Record<number, number>;
  onChange: (next: Record<number, number>) => void;
}) {
  return (
    <div>
      <Text strong style={{ color: "var(--ink)" }}>
        {dict.stagePricesSection}
      </Text>
      <div className="mt-2 flex flex-col gap-3">
        <Text type="secondary">{dict.stagePricesHint}</Text>
        {stages.length === 0 ? (
          <Text type="secondary">{dict.stagePricesEmpty}</Text>
        ) : (
          stages.map((st) => (
            <div
              key={st.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
              style={{ border: "1px solid var(--border)" }}
            >
              <div className="min-w-0">
                <div className="font-medium" style={{ color: "var(--ink)" }}>{st.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dict.minPriceLabel}: {(st.min / 100).toFixed(2)} {st.currency}
                </Text>
              </div>
              <InputNumber
                min={st.min / 100}
                step={0.5}
                value={value[st.id] != null ? value[st.id] / 100 : null}
                onChange={(v) =>
                  onChange({ ...value, [st.id]: Math.round((v ?? 0) * 100) })
                }
                addonAfter={st.currency}
                placeholder={dict.yourPrice}
                style={{ width: 170 }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AvailabilityField({
  dict,
  picked,
  onChange,
}: {
  dict: ApplyDict;
  picked: PickedAvailability[];
  onChange: (next: PickedAvailability[]) => void;
}) {
  const weekdays = dict.weekdays ?? [];
  const [weekday, setWeekday] = useState(0);
  const [start, setStart] = useState<dayjs.Dayjs | null>(null);
  const [end, setEnd] = useState<dayjs.Dayjs | null>(null);

  return (
    <div>
      <Text strong style={{ color: "var(--ink)" }}>
        {dict.availabilitySection}
      </Text>
      <div className="mt-2 flex flex-col gap-3">
        <Text type="secondary">{dict.availabilityHint}</Text>
        {picked.length === 0 ? (
          <Text type="secondary">{dict.noAvailability}</Text>
        ) : (
          <Space size={[8, 8]} wrap>
            {picked.map((a, i) => (
              <Tag key={i} closable onClose={() => onChange(picked.filter((_, idx) => idx !== i))}>
                {weekdays[a.weekday]} {a.start_time}–{a.end_time}
              </Tag>
            ))}
          </Space>
        )}
        <Space wrap>
          <Select
            value={weekday}
            onChange={setWeekday}
            style={{ width: 130 }}
            options={weekdays.map((d, i) => ({ value: i, label: d }))}
          />
          <TimePicker value={start} onChange={setStart} format="HH:mm" minuteStep={15} placeholder={dict.startTime} />
          <TimePicker value={end} onChange={setEnd} format="HH:mm" minuteStep={15} placeholder={dict.endTime} />
          <Button
            type="primary"
            disabled={!start || !end}
            onClick={() => {
              if (start && end) {
                onChange([
                  ...picked,
                  { weekday, start_time: start.format("HH:mm"), end_time: end.format("HH:mm") },
                ]);
                setStart(null);
                setEnd(null);
              }
            }}
          >
            {dict.addAvailability}
          </Button>
        </Space>
      </div>
    </div>
  );
}
