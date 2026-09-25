"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { catalog, catalogName, type Stage } from "@/lib/catalog";
import { isValidLocalMobile, marketLabel } from "@/lib/markets";
import { toE164 } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import CountryPhoneFields from "./country-phone-fields";
import { fmt, type AuthDict } from "./fmt";
import { AuthForm, AuthPanel } from "./shell";

export default function SignUpForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const otpChannel = useOtpChannel();
  const emailOtp = otpChannel === "email";

  useEffect(() => {
    catalog.listStages().then(setStages).catch(() => setStages([]));
  }, []);

  const schema = useMemo(
    () =>
      z
        .object({
          full_name: z.string().trim().min(1, dict.requiredName),
          market: z.string().min(1, dict.requiredCountry),
          phone: z.string().trim().min(1, dict.requiredPhone),
          // Only collected on the email OTP channel; validated in the refine below.
          email: z.string().trim().optional(),
          locale: z.string().min(1),
          vertical: z.string().min(1, dict.requiredStage),
          password: z.string().min(8, dict.passwordMin),
          confirm: z.string().min(1, dict.requiredPassword),
        })
        .refine((v) => v.password === v.confirm, {
          path: ["confirm"],
          message: dict.passwordMismatch,
        })
        // The number must look like a mobile in the chosen country: a Cairo
        // landline typed here fails at OTP time otherwise, long after signup.
        .refine((v) => !v.market || !v.phone || isValidLocalMobile(v.market, v.phone), {
          path: ["phone"],
          message: "invalid-mobile",
        })
        .refine((v) => !emailOtp || (v.email ?? "").length > 0, {
          path: ["email"],
          message: dict.requiredEmail,
        })
        .refine((v) => !emailOtp || z.email().safeParse(v.email).success, {
          path: ["email"],
          message: dict.invalidEmail,
        }),
    [dict, emailOtp],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: "",
      market: "",
      phone: "",
      email: "",
      locale,
      vertical: "",
      password: "",
      confirm: "",
    },
  });

  const market = watch("market");
  // The country name is only known at render time, so the placeholder message
  // from the schema is swapped for the real sentence here.
  const phoneError =
    errors.phone?.message === "invalid-mobile"
      ? fmt(dict.invalidPhoneForCountry, { country: marketLabel(market, locale) })
      : errors.phone?.message;

  async function onSubmit(values: Values) {
    setLoading(true);
    try {
      const res = await authApi.signup({
        full_name: values.full_name,
        phone: toE164(values.phone, values.market),
        ...(emailOtp ? { email: values.email } : {}),
        market: values.market,
        locale: values.locale,
        vertical: Number(values.vertical),
        password: values.password,
      });
      toast.success(dict.signupSuccess);
      const to = res.otp_channel === "email" ? `&to=${encodeURIComponent(res.destination)}` : "";
      router.push(`/${locale}/verify?phone=${encodeURIComponent(res.phone)}${to}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel
      title={dict.signUpTitle}
      footer={
        <>
          {dict.haveAccount}{" "}
          <Link href={`/${locale}/sign-in`} className="link-brand font-semibold">
            {dict.signIn}
          </Link>
        </>
      }
    >
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <Field id="full_name" label={dict.fullName} error={errors.full_name?.message} required>
          <Input autoComplete="name" {...register("full_name")} />
        </Field>

        <CountryPhoneFields
          dict={dict}
          locale={locale}
          market={market}
          onMarketChange={(code) =>
            setValue("market", code ?? "", { shouldValidate: Boolean(code) })
          }
          phoneProps={register("phone")}
          marketError={errors.market?.message}
          phoneError={phoneError}
          countryHint={dict.chooseCountrySubtitle}
        />

        {emailOtp ? (
          <Field
            id="email"
            label={dict.email}
            hint={dict.emailHint}
            error={errors.email?.message}
            required
          >
            <Input dir="ltr" inputMode="email" autoComplete="email" {...register("email")} />
          </Field>
        ) : null}

        <Field id="locale" label={dict.language} error={errors.locale?.message} required>
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

        <Field id="vertical" label={dict.stage} error={errors.vertical?.message} required>
          <Controller
            control={control}
            name="vertical"
            render={({ field }) => (
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="vertical">
                  <SelectValue placeholder={dict.selectStage} />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {catalogName(s, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field id="password" label={dict.password} error={errors.password?.message} required>
          <PasswordInput
            autoComplete="new-password"
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
            {...register("password")}
          />
        </Field>

        <Field id="confirm" label={dict.confirmPassword} error={errors.confirm?.message} required>
          <PasswordInput
            autoComplete="new-password"
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
            {...register("confirm")}
          />
        </Field>

        <Button type="submit" size="lg" block loading={loading} disabled={otpChannel === null}>
          {dict.signUp}
        </Button>
      </AuthForm>
    </AuthPanel>
  );
}
