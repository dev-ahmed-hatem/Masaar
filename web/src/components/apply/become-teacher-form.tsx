"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, PartyPopper } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { submitApplication } from "@/lib/applications";
import { useOtpChannel } from "@/lib/auth-config";
import { cn } from "@/lib/cn";
import { LANGUAGE_OPTIONS } from "@/lib/languages";
import { guessMarket, rememberMarket } from "@/lib/markets";
import { toStageCardInput, type StageCard } from "@/lib/stage-cards";
import type { Certification, Education, Experience } from "@/lib/teachers";
import CountryPhoneFields from "@/components/auth/country-phone-fields";
import PhotoPicker from "@/components/teaching/photo-picker";
import ResumeList from "@/components/teaching/resume-list";
import StageCardsEditor from "@/components/teaching/stage-cards-editor";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/chip-group";
import { EmptyState } from "@/components/ui/empty";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagsInput } from "@/components/ui/tags-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

export type ApplyDict = Dictionary["apply"];
type AuthDict = Dictionary["auth"];
type CardsDict = Dictionary["stageCards"];

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

interface FormValues {
  market: string;
  full_name: string;
  phone: string;
  email: string;
  gender: string;
  languages: string[];
  bio: string;
  bio_ar: string;
  intro_video_url: string;
  specialties: string[];
  education: Education[];
  work_experience: Experience[];
  certifications: Certification[];
}

/** Which fields each step owns, so "Continue" only validates what's on screen. */
const STEP_FIELDS: FieldPath<FormValues>[][] = [
  ["market", "full_name", "phone", "email", "gender", "languages"],
  ["bio", "intro_video_url"],
  [],
];

export default function BecomeTeacherForm({
  dict,
  authDict,
  cards: cardsDict,
  locale,
}: {
  dict: ApplyDict;
  authDict: AuthDict;
  cards: CardsDict;
  locale: string;
}) {
  const toast = useToast();
  const emailOtp = useOtpChannel() === "email";
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  // Draft stage cards (validated again server-side on submit).
  const [stages, setStages] = useState<StageCard[]>([]);
  const [stagesError, setStagesError] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const steps = [dict.basicsSection, dict.aboutSection, dict.teachingSection];

  const schema = useMemo(
    () =>
      z.object({
        market: z.string().min(1, authDict.requiredCountry),
        full_name: z.string().trim().min(1, dict.requiredName),
        phone: z.string().trim().min(1, dict.requiredPhone),
        email: z.email(dict.requiredEmail),
        gender: z.enum(["MALE", "FEMALE"], { message: dict.requiredGender }),
        languages: z.array(z.string()).min(1, dict.requiredLanguages),
        bio: z.string().trim().min(1, dict.requiredBio),
        bio_ar: z.string(),
        intro_video_url: z
          .string()
          .trim()
          .min(1, dict.requiredVideo)
          .refine((v) => /^https?:\/\/\S+$/i.test(v), dict.invalidUrl),
        specialties: z.array(z.string()),
        education: z.array(z.record(z.string(), z.string())),
        work_experience: z.array(z.record(z.string(), z.string())),
        certifications: z.array(z.record(z.string(), z.string())),
      }),
    [dict, authDict],
  );

  const {
    control,
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      market: "",
      full_name: "",
      phone: "",
      email: "",
      gender: "",
      languages: [],
      bio: "",
      bio_ar: "",
      intro_video_url: "",
      specialties: [],
      education: [],
      work_experience: [],
      certifications: [],
    },
  });

  const market = watch("market");

  // Client-only: reads localStorage and the device timezone.
  useEffect(() => {
    setValue("market", guessMarket());
  }, [setValue]);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(
    () => () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    },
    [photoPreview],
  );

  function goTo(next: number) {
    setStep(next);
    topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const lastStep = steps.length - 1;

  /**
   * One <form> spans all three steps, so submission has to be routed: on the
   * first two steps it validates just that step and moves on — which also
   * makes Enter advance instead of firing the application off early.
   *
   * The two buttons are both `type="submit"` for the same reason. When the
   * trailing button switched from button to submit between steps, React's
   * synchronous re-render swapped the type mid-click and the browser then
   * submitted the form the moment you reached the last step.
   */
  async function onFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < lastStep) {
      if (await trigger(STEP_FIELDS[step])) goTo(step + 1);
      return;
    }
    await handleSubmit(onSubmit)();
  }

  async function onSubmit(values: FormValues) {
    if (stages.length === 0) {
      setStagesError(true);
      toast.error(dict.requiredStages);
      return;
    }
    setSubmitting(true);
    try {
      await submitApplication({
        full_name: values.full_name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        market: values.market,
        gender: values.gender as "MALE" | "FEMALE",
        languages: values.languages.join(","),
        bio: values.bio,
        bio_ar: values.bio_ar || undefined,
        intro_video_url: values.intro_video_url.trim(),
        specialties: values.specialties,
        education: values.education,
        work_experience: values.work_experience,
        certifications: values.certifications,
        stages: stages.map(toStageCardInput),
        photo,
      });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_application") {
        toast.error(dict.duplicate);
      } else {
        toast.error(err instanceof ApiError ? err.message : dict.genericError);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          icon={<PartyPopper aria-hidden />}
          title={dict.successTitle}
          description={emailOtp ? dict.successBodyEmail : dict.successBody}
          action={
            <Button asChild>
              <Link href={`/${locale}`}>{dict.backHome}</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div ref={topRef} className="mx-auto flex max-w-3xl flex-col gap-6 scroll-mt-24">
      <header className="flex flex-col items-center gap-3 text-center">
        <Badge variant="brand">{dict.badge}</Badge>
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-prose t-body text-ink-muted">{dict.intro}</p>
      </header>

      <Stepper steps={steps} current={step} label={dict.stepOf} onGoTo={goTo} />

      {/* One form across all three steps: going back must never lose an answer,
          so the fields stay mounted in react-hook-form's state either way. */}
      <form noValidate onSubmit={onFormSubmit} className="flex flex-col gap-5">
        {step === 0 ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{dict.howItWorks}</CardTitle>
              </CardHeader>
              <ol className="flex flex-col gap-2 p-5 pt-0">
                {[dict.step1, emailOtp ? dict.step2Email : dict.step2, dict.step3].map((s, i) => (
                  <li key={s} className="flex items-start gap-3 t-small text-ink-muted">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint t-caption font-bold text-on-brand-tint">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{dict.basicsSection}</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-4 p-5 pt-0">
                <CountryPhoneFields
                  dict={authDict}
                  locale={locale}
                  market={market || undefined}
                  onMarketChange={(code) => {
                    setValue("market", code ?? "", { shouldValidate: true });
                    // Prices and minimums are per market: a country switch
                    // invalidates the stage cards built against the old one.
                    if (code) {
                      rememberMarket(code);
                      setStages([]);
                    }
                  }}
                  marketError={errors.market?.message}
                  phoneError={errors.phone?.message}
                  phoneHint={emailOtp ? dict.phoneHintEmail : dict.phoneHint}
                  phoneProps={register("phone")}
                />

                <Field
                  id="full_name"
                  label={dict.fullName}
                  error={errors.full_name?.message}
                  required
                >
                  <Input dir="auto" autoComplete="name" {...register("full_name")} />
                </Field>

                <Field
                  id="email"
                  label={dict.email}
                  hint={emailOtp ? dict.emailHintEmail : undefined}
                  error={errors.email?.message}
                  required
                >
                  <Input dir="ltr" inputMode="email" autoComplete="email" {...register("email")} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="gender" label={dict.gender} error={errors.gender?.message} required>
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="gender">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MALE">{dict.male}</SelectItem>
                            <SelectItem value="FEMALE">{dict.female}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field
                    id="languages"
                    label={dict.languages}
                    error={errors.languages?.message}
                    required
                  >
                    <Controller
                      control={control}
                      name="languages"
                      render={({ field }) => (
                        <ChipGroup
                          id="languages"
                          label={dict.languages}
                          options={LANGUAGE_OPTIONS.map((l) => ({
                            value: l.value,
                            label: l.label,
                          }))}
                          value={field.value}
                          onChange={field.onChange}
                          invalid={Boolean(errors.languages)}
                        />
                      )}
                    />
                  </Field>
                </div>

                <PhotoPicker
                  src={photoPreview}
                  name={watch("full_name")}
                  hint={dict.photoHint}
                  uploadLabel={dict.photoUpload}
                  replaceLabel={dict.photoReplace}
                  removeLabel={dict.photoRemove}
                  onPick={setPhoto}
                  onRemove={() => setPhoto(null)}
                />
              </div>
            </Card>
          </>
        ) : null}

        {step === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>{dict.aboutSection}</CardTitle>
              <CardDescription>{dict.bioHint}</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-4 p-5 pt-0">
              <Field id="bio" label={dict.bioEn} error={errors.bio?.message} required>
                <Textarea dir="ltr" rows={4} maxLength={2000} {...register("bio")} />
              </Field>

              <Field id="bio_ar" label={dict.bioAr}>
                <Textarea dir="rtl" rows={4} maxLength={2000} {...register("bio_ar")} />
              </Field>

              <Field
                id="intro_video_url"
                label={dict.video}
                hint={dict.videoHint}
                error={errors.intro_video_url?.message}
                required
              >
                <Input
                  dir="ltr"
                  inputMode="url"
                  placeholder="https://youtube.com/watch?v=…"
                  {...register("intro_video_url")}
                />
              </Field>

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
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle>{dict.teachingSection}</CardTitle>
              <CardDescription>{dict.teachingHint}</CardDescription>
            </CardHeader>
            <div className="flex flex-col gap-3 p-5 pt-0">
              {stagesError && stages.length === 0 ? (
                <Alert variant="error" title={dict.requiredStages} />
              ) : null}
              <StageCardsEditor
                dict={cardsDict}
                locale={locale}
                market={market || "EG"}
                cards={stages}
                onSave={async (_input, preview, existing) => {
                  setStagesError(false);
                  setStages((prev) =>
                    existing
                      ? prev.map((c) => (c.id === existing.id ? { ...preview, id: existing.id } : c))
                      : [...prev, preview],
                  );
                }}
                onRemove={async (card) => setStages((prev) => prev.filter((c) => c.id !== card.id))}
              />
            </div>
          </Card>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
              <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
              {dict.back}
            </Button>
          ) : (
            <span />
          )}

          {step < lastStep ? (
            <Button type="submit">
              {dict.next}
              <ArrowRight className="rtl:-scale-x-100" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="lg" variant="accent" loading={submitting}>
              {dict.submit}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/**
 * Progress across the three steps. Completed steps are clickable (going back
 * never loses an answer); later ones are not, because they haven't been
 * validated yet.
 */
function Stepper({
  steps,
  current,
  label,
  onGoTo,
}: {
  steps: string[];
  current: number;
  label: string;
  onGoTo: (index: number) => void;
}) {
  return (
    <nav
      aria-label={label.replace("{n}", String(current + 1)).replace("{total}", String(steps.length))}
      className="flex flex-col gap-2"
    >
      <p className="t-caption font-semibold text-ink-muted">
        {label.replace("{n}", String(current + 1)).replace("{total}", String(steps.length))}
      </p>
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {steps.map((title, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={title} className="flex items-center gap-3">
              <button
                type="button"
                disabled={i > current}
                onClick={() => onGoTo(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-pill px-3 py-1.5 t-small font-semibold transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active && "bg-brand text-on-brand",
                  done && "bg-brand-tint text-on-brand-tint hover:bg-brand hover:text-on-brand",
                  !active && !done && "text-ink-faint",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "inline-flex size-5 items-center justify-center rounded-full t-caption font-bold",
                    active ? "bg-on-brand/20" : done ? "bg-surface" : "bg-surface-2",
                  )}
                >
                  {done ? <Check className="size-3" /> : i + 1}
                </span>
                {title}
              </button>
              {i < steps.length - 1 ? (
                <span aria-hidden className="hidden h-px w-6 bg-border sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
