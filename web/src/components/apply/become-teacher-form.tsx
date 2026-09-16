"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Result,
  Select,
  Space,
  Typography,
} from "antd";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { submitApplication } from "@/lib/applications";
import { useOtpChannel } from "@/lib/auth-config";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { findMarket, guessMarket, rememberMarket } from "@/lib/markets";
import { toStageCardInput, type StageCard } from "@/lib/stage-cards";
import StageCardsEditor from "@/components/teaching/stage-cards-editor";
import CountrySelect, { CountryFlag } from "@/components/ui/country-select";

const { Title, Paragraph, Text } = Typography;

export type ApplyDict = Dictionary["apply"];
type CardsDict = Dictionary["stageCards"];

export default function BecomeTeacherForm({
  dict,
  cards: cardsDict,
  locale,
}: {
  dict: ApplyDict;
  cards: CardsDict;
  locale: string;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const emailOtp = useOtpChannel() === "email";

  // The chosen country (form field); preselected from the last choice / device timezone.
  const market: string = Form.useWatch("market", form) ?? "EG";
  const [photo, setPhoto] = useState<File | null>(null);
  // Draft stage cards (validated again server-side on submit).
  const [stages, setStages] = useState<StageCard[]>([]);
  const [stagesError, setStagesError] = useState(false);

  useEffect(() => {
    form.setFieldValue("market", guessMarket());
  }, [form]);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  async function onFinish(values: Record<string, unknown>) {
    if (stages.length === 0) {
      setStagesError(true);
      message.error(dict.requiredStages);
      return;
    }
    setSubmitting(true);
    try {
      await submitApplication({
        full_name: values.full_name as string,
        phone: values.phone as string,
        email: values.email as string,
        market: values.market as string,
        gender: values.gender as "MALE" | "FEMALE",
        languages: (values.languages as string[]).join(","),
        bio: values.bio as string,
        bio_ar: (values.bio_ar as string) || undefined,
        intro_video_url: values.intro_video_url as string,
        specialties: (values.specialties as string[]) ?? [],
        education: ((values.education as never[]) ?? []).filter(Boolean),
        work_experience: ((values.work_experience as never[]) ?? []).filter(Boolean),
        certifications: ((values.certifications as never[]) ?? []).filter(Boolean),
        stages: stages.map(toStageCardInput),
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
          subTitle={emailOtp ? dict.successBodyEmail : dict.successBody}
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
        {[dict.step1, emailOtp ? dict.step2Email : dict.step2, dict.step3].map((step, i) => (
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
        initialValues={{ market: "EG" }}
        onValuesChange={(changed: { market?: string }) => {
          // Prices and minimums are per market: a country switch clears the stages.
          if (changed.market) {
            rememberMarket(changed.market);
            setStages([]);
          }
        }}
      >
        <div className="flex flex-col gap-6">
          <Card title={dict.basicsSection}>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
                <CountrySelect locale={locale} showDial />
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
                extra={emailOtp ? dict.phoneHintEmail : dict.phoneHint}
              >
                <Input
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel-national"
                  prefix={
                    <span
                      dir="ltr"
                      className="me-1 inline-flex items-center gap-1.5 pe-2 tabular-nums"
                      style={{ borderInlineEnd: "1px solid var(--border)", color: "var(--ink-muted)" }}
                    >
                      <CountryFlag code={market} size={14} />
                      {findMarket(market)?.dial}
                    </span>
                  }
                />
              </Form.Item>
              <Form.Item
                name="email"
                label={dict.email}
                extra={emailOtp ? dict.emailHintEmail : undefined}
                rules={[
                  { required: true, message: dict.requiredEmail },
                  { type: "email", message: dict.requiredEmail },
                ]}
              >
                <Input inputMode="email" autoComplete="email" dir="ltr" />
              </Form.Item>
              <Form.Item name="gender" label={dict.gender} rules={[{ required: true, message: dict.requiredGender }]}>
                <Select
                  options={[
                    { value: "MALE", label: dict.male },
                    { value: "FEMALE", label: dict.female },
                  ]}
                />
              </Form.Item>
              <Form.Item
                name="languages"
                label={dict.languages}
                rules={[{ required: true, type: "array", min: 1, message: dict.requiredLanguages }]}
              >
                <Select mode="multiple" options={LANGUAGE_OPTIONS.map(({ value, label }) => ({ value, label }))} />
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
              rules={[
                { required: true, message: dict.requiredVideo },
                { type: "url", message: dict.invalidUrl },
              ]}
            >
              <Input placeholder="https://youtube.com/watch?v=…" dir="ltr" />
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
            {stagesError && stages.length === 0 && (
              <Alert type="error" showIcon message={dict.requiredStages} className="mb-3" />
            )}
            <StageCardsEditor
              dict={cardsDict}
              locale={locale}
              market={market}
              cards={stages}
              onSave={async (_input, preview, existing) => {
                setStages((prev) =>
                  existing ? prev.map((c) => (c.id === existing.id ? { ...preview, id: existing.id } : c)) : [...prev, preview],
                );
              }}
              onRemove={async (card) => setStages((prev) => prev.filter((c) => c.id !== card.id))}
            />
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
