"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import type { StageCard } from "@/lib/stage-cards";
import type { Certification, Education, Experience } from "@/lib/teachers";
import { teacherSelf, type TeacherProfile } from "@/lib/teacher-self";
import GoogleCalendarCard from "@/components/integrations/google-calendar-card";
import PhotoPicker from "@/components/teaching/photo-picker";
import ResumeList from "@/components/teaching/resume-list";
import StageCardsEditor from "@/components/teaching/stage-cards-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TagsInput } from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["teacherProfile"];
type GcalDict = Dictionary["googleCalendar"];
type CardsDict = Dictionary["stageCards"];

/** Radix Select has no empty value, so "not set" travels as a sentinel. */
const NONE = "__none";

const BLANK_EDUCATION: Education = {
  degree: "",
  institution: "",
  start_year: "",
  end_year: "",
  description: "",
};
const BLANK_EXPERIENCE: Experience = {
  title: "",
  organization: "",
  start_year: "",
  end_year: "",
  description: "",
};
const BLANK_CERTIFICATION: Certification = {
  name: "",
  issuer: "",
  year: "",
  description: "",
};

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return m ? m[1] : null;
}

interface FormValues {
  full_name: string;
  gender: string;
  languages: string[];
  bio_en: string;
  bio_ar: string;
  intro_video_url: string;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
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
  const toast = useToast();
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [stages, setStages] = useState<StageCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [incompleteStages, setIncompleteStages] = useState<number[]>([]);
  const [tab, setTab] = useState("basics");
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, dict.requiredName),
        gender: z.string(),
        languages: z.array(z.string()),
        bio_en: z.string(),
        bio_ar: z.string(),
        intro_video_url: z
          .string()
          .trim()
          .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), dict.invalidUrl),
        specialties: z.array(z.string()),
        education: z.array(z.record(z.string(), z.string())),
        work_experience: z.array(z.record(z.string(), z.string())),
        certifications: z.array(z.record(z.string(), z.string())),
      }),
    [dict],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      full_name: "",
      gender: NONE,
      languages: [],
      bio_en: "",
      bio_ar: "",
      intro_video_url: "",
      specialties: [],
      education: [],
      work_experience: [],
      certifications: [],
    },
  });

  const fail = useCallback(
    (err: unknown) => toast.error(err instanceof ApiError ? err.message : dict.actionError),
    [toast, dict.actionError],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([teacherSelf.getProfile(), teacherSelf.listStages()])
      .then(([p, cards]) => {
        setProfile(p);
        setStages(cards);
        reset({
          full_name: p.full_name,
          gender: p.gender || NONE,
          languages: p.languages ? p.languages.split(",").filter(Boolean) : [],
          bio_en: p.bio_en,
          bio_ar: p.bio_ar,
          intro_video_url: p.intro_video_url,
          specialties: p.specialties ?? [],
          education: p.education ?? [],
          work_experience: p.work_experience ?? [],
          certifications: p.certifications ?? [],
        });
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError, reset]);

  useEffect(() => load(), [load]);

  async function save(values: FormValues) {
    setSaving(true);
    try {
      const updated = await teacherSelf.updateProfile({
        full_name: values.full_name.trim(),
        gender: (values.gender === NONE ? "" : values.gender) as TeacherProfile["gender"],
        languages: values.languages.join(","),
        bio_en: values.bio_en,
        bio_ar: values.bio_ar,
        intro_video_url: values.intro_video_url.trim(),
        specialties: values.specialties,
        education: values.education,
        work_experience: values.work_experience,
        certifications: values.certifications,
      });
      setProfile(updated);
      toast.success(dict.saved);
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!profile) return;
    setPublishing(true);
    try {
      setMissing([]);
      setIncompleteStages([]);
      const updated = profile.is_published
        ? await teacherSelf.unpublish()
        : await teacherSelf.publish();
      setProfile(updated);
      toast.success(updated.is_published ? dict.publishSuccess : dict.unpublishSuccess);
    } catch (err) {
      if (err instanceof ApiError && err.code === "profile_incomplete") {
        const detail = err.detail as
          | { missing?: string[]; incomplete_stages?: number[] }
          | undefined;
        const gaps = detail?.missing ?? [];
        setMissing(gaps);
        setIncompleteStages(detail?.incomplete_stages ?? []);
        // Send the teacher where the work is: anything but the bio lives in
        // the stage cards.
        if (gaps.some((m) => m !== "bio")) setTab("stages");
      } else {
        fail(err);
      }
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <EditorSkeleton />;

  if (error || !profile) {
    return (
      <Alert
        variant="error"
        title={error ?? dict.loadError}
        action={
          <Button variant="outline" size="sm" onClick={load}>
            {dict.retry}
          </Button>
        }
      />
    );
  }

  const video = youtubeId(watch("intro_video_url") ?? "");

  return (
    <section className="flex flex-col gap-5 pb-24 lg:pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="t-h1 text-ink">{dict.title}</h1>
          <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
        </div>
        <Badge variant={profile.is_published ? "success" : "warning"}>
          {profile.is_published ? dict.statusPublished : dict.statusDraft}
        </Badge>
      </header>

      {missing.length > 0 ? (
        <Alert variant="warning" title={dict.incomplete}>
          <ul className="ms-4 list-disc">
            {missing.includes("bio") ? <li>{dict.missingBio}</li> : null}
            {missing.includes("stage") ? <li>{dict.missingStage}</li> : null}
            {missing.includes("subject") ? <li>{dict.missingSubject}</li> : null}
            {missing.includes("price") ? <li>{dict.missingPrice}</li> : null}
            {missing.includes("availability") ? <li>{dict.missingAvailability}</li> : null}
          </ul>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <TabsList>
          <TabsTrigger value="basics">{dict.basicsTab}</TabsTrigger>
          <TabsTrigger value="resume">{dict.resumeTab}</TabsTrigger>
          <TabsTrigger value="stages">{dict.stagesTab}</TabsTrigger>
          <TabsTrigger value="calendar">{dict.calendarTab}</TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{dict.photoSection}</CardTitle>
            </CardHeader>
            <div className="p-5 pt-0">
              <PhotoPicker
                src={profile.photo_url}
                name={profile.full_name}
                hint={dict.photoHint}
                uploadLabel={dict.photoUpload}
                replaceLabel={dict.photoReplace}
                removeLabel={dict.photoRemove}
                busy={photoBusy}
                onPick={async (file) => {
                  setPhotoBusy(true);
                  try {
                    setProfile(await teacherSelf.uploadPhoto(file));
                    toast.success(dict.photoUpdated);
                  } catch (err) {
                    fail(err);
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
                onRemove={async () => {
                  setPhotoBusy(true);
                  try {
                    setProfile(await teacherSelf.removePhoto());
                  } catch (err) {
                    fail(err);
                  } finally {
                    setPhotoBusy(false);
                  }
                }}
              />
            </div>
          </Card>

          {/* Two <form>s, one react-hook-form: fields in the unmounted tab keep
              their values, so either Save button submits the whole profile. */}
          <form noValidate onSubmit={handleSubmit(save)}>
            <Card>
              <CardHeader>
                <CardTitle>{dict.profileSection}</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-4 p-5 pt-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="full_name"
                    label={dict.fullName}
                    error={errors.full_name?.message}
                    required
                  >
                    <Input dir="auto" autoComplete="name" {...register("full_name")} />
                  </Field>

                  <Field id="gender" label={dict.gender}>
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="gender">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            <SelectItem value="MALE">{dict.male}</SelectItem>
                            <SelectItem value="FEMALE">{dict.female}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </div>

                <Field id="languages" label={dict.languages}>
                  <Controller
                    control={control}
                    name="languages"
                    render={({ field }) => (
                      <ChipGroup
                        id="languages"
                        label={dict.languages}
                        options={LANGUAGE_OPTIONS.map((l) => ({ value: l.value, label: l.label }))}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>

                <Field id="bio_en" label={dict.bioEn}>
                  <Textarea dir="ltr" rows={4} {...register("bio_en")} />
                </Field>

                <Field id="bio_ar" label={dict.bioAr}>
                  <Textarea dir="rtl" rows={4} {...register("bio_ar")} />
                </Field>

                <Field
                  id="intro_video_url"
                  label={dict.introVideoUrl}
                  hint={dict.videoHint}
                  error={errors.intro_video_url?.message}
                >
                  <Input
                    dir="ltr"
                    inputMode="url"
                    placeholder="https://youtu.be/…"
                    {...register("intro_video_url")}
                  />
                </Field>

                {video ? (
                  <div className="flex flex-col gap-2">
                    <span className="t-caption text-ink-muted">{dict.videoPreview}</span>
                    <div className="aspect-video max-w-md overflow-hidden rounded-card border border-border">
                      <iframe
                        src={`https://www.youtube.com/embed/${video}`}
                        title={dict.videoPreview}
                        allowFullScreen
                        className="size-full border-0"
                      />
                    </div>
                  </div>
                ) : null}

                <Field id="specialties" label={dict.specialties} hint={dict.specialtiesHint}>
                  <Controller
                    control={control}
                    name="specialties"
                    render={({ field }) => (
                      <TagsInput
                        id="specialties"
                        value={field.value}
                        onChange={field.onChange}
                        removeLabel={dict.remove}
                      />
                    )}
                  />
                </Field>

                <Button type="submit" loading={saving} className="self-start">
                  {dict.save}
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="resume">
          <form noValidate onSubmit={handleSubmit(save)}>
            <Card>
              <CardHeader>
                <CardTitle>{dict.resumeTab}</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-6 p-5 pt-0">
                <Controller
                  control={control}
                  name="education"
                  render={({ field }) => (
                    <ResumeList
                      idPrefix="education"
                      title={dict.educationSection}
                      addLabel={dict.addEducation}
                      removeLabel={dict.remove}
                      blank={BLANK_EDUCATION}
                      value={field.value}
                      onChange={field.onChange}
                      fields={[
                        { name: "degree", label: dict.degree },
                        { name: "institution", label: dict.institution },
                        { name: "start_year", label: dict.startYear, year: true },
                        { name: "end_year", label: dict.endYear, year: true },
                        { name: "description", label: dict.description, area: true },
                      ]}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="work_experience"
                  render={({ field }) => (
                    <ResumeList
                      idPrefix="work"
                      title={dict.experienceSection}
                      addLabel={dict.addExperience}
                      removeLabel={dict.remove}
                      blank={BLANK_EXPERIENCE}
                      value={field.value}
                      onChange={field.onChange}
                      fields={[
                        { name: "title", label: dict.jobTitle },
                        { name: "organization", label: dict.organization },
                        { name: "start_year", label: dict.startYear, year: true },
                        { name: "end_year", label: dict.endYear, year: true },
                        { name: "description", label: dict.description, area: true },
                      ]}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="certifications"
                  render={({ field }) => (
                    <ResumeList
                      idPrefix="cert"
                      title={dict.certificationsSection}
                      addLabel={dict.addCertification}
                      removeLabel={dict.remove}
                      blank={BLANK_CERTIFICATION}
                      value={field.value}
                      onChange={field.onChange}
                      fields={[
                        { name: "name", label: dict.certName },
                        { name: "issuer", label: dict.issuer },
                        { name: "year", label: dict.year, year: true },
                        { name: "description", label: dict.description, area: true },
                      ]}
                    />
                  )}
                />

                <Button type="submit" loading={saving} className="self-start">
                  {dict.save}
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="stages">
          <Card>
            <CardHeader>
              <CardTitle>{dict.stagesSection}</CardTitle>
              <CardDescription>{dict.stagesHint}</CardDescription>
            </CardHeader>
            <div className="p-5 pt-0">
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
                    toast.success(dict.stageSaved);
                  } catch (err) {
                    fail(err);
                    throw err; // keep the dialog open
                  }
                }}
                onRemove={async (card) => {
                  try {
                    await teacherSelf.deleteStage(card.id);
                    setStages((prev) => prev.filter((c) => c.id !== card.id));
                    toast.success(dict.stageRemoved);
                  } catch (err) {
                    if (err instanceof ApiError && err.code === "stage_in_use") {
                      toast.error(cardsDict.stageInUse);
                    } else {
                      fail(err);
                    }
                  }
                }}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <GoogleCalendarCard dict={gcal} locale={locale} />
        </TabsContent>
      </Tabs>

      {/* Publishing is the one decision that applies to the whole page, so the
          bar follows the teacher on mobile — clearing the tab bar. */}
      <div className="fixed inset-x-0 bottom-16 z-20 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:static lg:rounded-card lg:border lg:pb-3">
        <span className="t-small text-ink-muted">
          {profile.is_published ? dict.publishedHint : dict.draftHint}
        </span>
        <Button
          variant={profile.is_published ? "outline" : "brand"}
          loading={publishing}
          onClick={togglePublish}
          className="shrink-0"
        >
          {profile.is_published ? dict.unpublish : dict.publish}
        </Button>
      </div>
    </section>
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-11 w-full max-w-md rounded-pill" />
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-96 rounded-card" />
    </div>
  );
}
