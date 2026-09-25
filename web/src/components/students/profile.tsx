"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Star } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getStudentProfile, updateMe, updateStudentProfile } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { listGradeLevels, listVerticals, type GradeLevel } from "@/lib/catalog";
import { listMyReviews, type Review } from "@/lib/reviews";
import GoogleCalendarCard from "@/components/integrations/google-calendar-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Rating } from "@/components/ui/rating";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["profile"];
type AuthDict = Dictionary["auth"];
type GcalDict = Dictionary["googleCalendar"];

const TABS = ["account", "learning", "security", "calendar", "reviews"] as const;

/** Radix Select has no empty value, so "not set" travels as a sentinel. */
const NONE = "__none";

export default function ProfileView({
  dict,
  authDict,
  gcal,
  locale,
}: {
  dict: Dict;
  authDict: AuthDict;
  gcal: GcalDict;
  locale: Locale;
}) {
  // Tab lives in the URL (?tab=…) so it's deep-linkable and survives refresh.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = (TABS as readonly string[]).includes(tabParam ?? "") ? tabParam! : "account";
  const setTab = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.subtitle}</p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-5">
        <TabsList>
          <TabsTrigger value="account">{dict.tabAccount}</TabsTrigger>
          <TabsTrigger value="learning">{dict.tabLearning}</TabsTrigger>
          <TabsTrigger value="security">{dict.tabSecurity}</TabsTrigger>
          <TabsTrigger value="calendar">{dict.tabCalendar}</TabsTrigger>
          <TabsTrigger value="reviews">{dict.tabReviews}</TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <AccountTab dict={dict} authDict={authDict} />
        </TabsContent>
        <TabsContent value="learning">
          <LearningTab dict={dict} locale={locale} />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab dict={dict} authDict={authDict} />
        </TabsContent>
        <TabsContent value="calendar">
          <GoogleCalendarCard dict={gcal} locale={locale} />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewsTab dict={dict} locale={locale} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** Card shell shared by every tab: heading, one-line purpose, then the form. */
function TabCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className ?? "max-w-lg"}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <div className="p-5 pt-0">{children}</div>
    </Card>
  );
}

function AccountTab({ dict, authDict }: { dict: Dict; authDict: AuthDict }) {
  const toast = useToast();
  const { user, setUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, authDict.requiredName),
        // Email is optional here (the account may be phone-only), but if one is
        // typed it has to be valid — the API sends receipts to it.
        email: z.union([z.literal(""), z.email(authDict.invalidEmail)]),
        locale: z.enum(["ar", "en"]),
      }),
    [authDict],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      email: user?.email ?? "",
      locale: user?.locale === "en" ? "en" : "ar",
    },
  });

  if (!user) return null;

  async function onSubmit(values: Values) {
    setSaving(true);
    try {
      setUser(await updateMe(values));
      toast.success(dict.saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TabCard title={dict.tabAccount} description={dict.accountIntro}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="full_name" label={dict.fullName} error={errors.full_name?.message} required>
          <Input dir="auto" autoComplete="name" {...register("full_name")} />
        </Field>

        <Field id="email" label={dict.email} error={errors.email?.message}>
          <Input dir="ltr" inputMode="email" autoComplete="email" {...register("email")} />
        </Field>

        <Field id="locale" label={dict.language}>
          <Controller
            control={control}
            name="locale"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {/* The phone is the account identity — changing it is a support action. */}
        <Field id="phone" label={dict.phone} hint={dict.phoneNote}>
          <Input dir="ltr" value={user.phone} disabled readOnly />
        </Field>

        <Button type="submit" loading={saving} className="self-start">
          {dict.save}
        </Button>
      </form>
    </TabCard>
  );
}

function LearningTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const ar = locale === "ar";
  const toast = useToast();
  const [stages, setStages] = useState<{ id: number; name_en: string; name_ar: string }[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
  } = useForm<{ vertical: string; grade_level: string; date_of_birth: string }>({
    defaultValues: { vertical: NONE, grade_level: NONE, date_of_birth: "" },
  });
  const vertical = watch("vertical");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [verticals, profile] = await Promise.all([listVerticals(), getStudentProfile()]);
        if (!active) return;
        setStages(verticals);
        reset({
          vertical: profile.vertical != null ? String(profile.vertical) : NONE,
          grade_level: profile.grade_level != null ? String(profile.grade_level) : NONE,
          date_of_birth: profile.date_of_birth ?? "",
        });
      } catch {
        /* an empty form is still usable */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [reset]);

  // Grade levels belong to one stage. Loading them all (as this form used to)
  // let a student save a grade from a different stage.
  useEffect(() => {
    if (vertical === NONE) {
      setGrades([]);
      return;
    }
    let active = true;
    listGradeLevels(Number(vertical))
      .then((rows) => active && setGrades(rows))
      .catch(() => active && setGrades([]));
    return () => {
      active = false;
    };
  }, [vertical]);

  async function onSubmit(values: {
    vertical: string;
    grade_level: string;
    date_of_birth: string;
  }) {
    setSaving(true);
    try {
      await updateStudentProfile({
        vertical: values.vertical === NONE ? null : Number(values.vertical),
        grade_level: values.grade_level === NONE ? null : Number(values.grade_level),
        date_of_birth: values.date_of_birth || null,
      });
      toast.success(dict.saved);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <TabCard title={dict.tabLearning} description={dict.learningIntro}>
        <div className="flex flex-col gap-4" aria-busy>
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </TabCard>
    );
  }

  return (
    <TabCard title={dict.tabLearning} description={dict.learningIntro}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field id="vertical" label={dict.stage}>
          <Controller
            control={control}
            name="vertical"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  // The old grade belongs to the old stage.
                  setValue("grade_level", NONE);
                }}
              >
                <SelectTrigger id="vertical">
                  <SelectValue placeholder={dict.selectStage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{dict.selectStage}</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {ar ? s.name_ar : s.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="grade_level" label={dict.gradeLevel}>
          <Controller
            control={control}
            name="grade_level"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={vertical === NONE || grades.length === 0}
              >
                <SelectTrigger id="grade_level">
                  <SelectValue placeholder={dict.selectGrade} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{dict.selectGrade}</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {ar ? g.name_ar : g.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        {/* A native date field: a birth year is typed, not navigated to — and
            the platform picker is the one students already know. */}
        <Field id="date_of_birth" label={dict.dateOfBirth}>
          <Input type="date" dir="ltr" max="9999-12-31" {...register("date_of_birth")} />
        </Field>

        <Button type="submit" loading={saving} className="self-start">
          {dict.save}
        </Button>
      </form>
    </TabCard>
  );
}

function SecurityTab({ dict, authDict }: { dict: Dict; authDict: AuthDict }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          old_password: z.string().min(1, authDict.requiredPassword),
          new_password: z.string().min(8, authDict.passwordMin),
          confirm: z.string().min(1, authDict.requiredPassword),
        })
        .refine((v) => v.new_password === v.confirm, {
          path: ["confirm"],
          message: dict.passwordMismatch,
        }),
    [authDict, dict.passwordMismatch],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    try {
      await authApi.changePassword(values.old_password, values.new_password);
      toast.success(dict.passwordChanged);
      reset();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TabCard title={dict.tabSecurity} description={dict.securityIntro}>
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field
          id="old_password"
          label={dict.currentPassword}
          error={errors.old_password?.message}
          required
        >
          <PasswordInput
            autoComplete="current-password"
            showLabel={authDict.showPassword}
            hideLabel={authDict.hidePassword}
            {...register("old_password")}
          />
        </Field>

        <Field
          id="new_password"
          label={dict.newPassword}
          error={errors.new_password?.message}
          required
        >
          <PasswordInput
            autoComplete="new-password"
            showLabel={authDict.showPassword}
            hideLabel={authDict.hidePassword}
            {...register("new_password")}
          />
        </Field>

        <Field id="confirm" label={dict.confirmPassword} error={errors.confirm?.message} required>
          <PasswordInput
            autoComplete="new-password"
            showLabel={authDict.showPassword}
            hideLabel={authDict.hidePassword}
            {...register("confirm")}
          />
        </Field>

        <Button type="submit" loading={saving} className="self-start">
          {dict.changePassword}
        </Button>
      </form>
    </TabCard>
  );
}

function ReviewsTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyReviews()
      .then((r) => active && setReviews(r.results))
      .catch(() => active && setReviews([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-card" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Star aria-hidden />}
          title={dict.noReviews}
          description={dict.reviewsIntro}
          action={
            <Button variant="outline" asChild>
              <Link href={`/${locale}/lessons`}>{dict.noReviewsCta}</Link>
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {reviews.map((r) => (
        <Card key={r.id} className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <span dir="auto" className="t-small font-semibold text-ink">
              {r.teacher_name}
            </span>
            <Rating value={r.rating} display="stars" size="sm" />
          </div>
          {r.text ? (
            <p dir="auto" className="t-small text-ink-muted">
              {r.text}
            </p>
          ) : null}
          <span className="t-caption text-ink-faint">
            {new Date(r.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
          </span>
        </Card>
      ))}
    </div>
  );
}
