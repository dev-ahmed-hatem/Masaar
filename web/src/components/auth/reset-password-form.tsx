"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import { fmt, type AuthDict } from "./fmt";
import { AuthForm, AuthPanel } from "./shell";
import { maskPhone, useCountdown } from "./use-countdown";

export default function ResetPasswordForm({
  dict,
  locale,
  phone,
}: {
  dict: AuthDict;
  locale: string;
  phone: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { left, reset } = useCountdown(60);
  const emailOtp = useOtpChannel() === "email";

  const schema = useMemo(
    () =>
      z
        .object({
          code: z.string().length(6, dict.requiredCode),
          new_password: z.string().min(8, dict.passwordMin),
          confirm: z.string().min(1, dict.requiredPassword),
        })
        .refine((v) => v.new_password === v.confirm, {
          path: ["confirm"],
          message: dict.passwordMismatch,
        }),
    [dict],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: "", new_password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    try {
      await authApi.resetConfirm(phone, values.code, values.new_password);
      toast.success(dict.resetSuccess);
      router.push(`/${locale}/sign-in`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await authApi.resend(phone, "RESET");
      reset();
      toast.success(dict.codeResent);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  return (
    <AuthPanel
      title={dict.resetTitle}
      subtitle={
        emailOtp ? dict.codeSentToAccountEmail : fmt(dict.codeSentTo, { phone: maskPhone(phone) })
      }
      footer={
        <Link href={`/${locale}/sign-in`} className="link-brand font-semibold">
          {dict.backToSignIn}
        </Link>
      }
    >
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <Field id="code" label={dict.code} error={errors.code?.message} required>
          <Controller
            control={control}
            name="code"
            render={({ field }) => (
              <OtpInput
                id="code"
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.code)}
                label={dict.code}
                className="justify-start"
              />
            )}
          />
        </Field>

        <Field id="new_password" label={dict.newPassword} error={errors.new_password?.message} required>
          <PasswordInput
            autoComplete="new-password"
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
            {...register("new_password")}
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

        <Button type="submit" size="lg" block loading={loading}>
          {dict.setPassword}
        </Button>

        <div className="text-center">
          <Button type="button" variant="link" disabled={left > 0} onClick={resend}>
            {left > 0 ? fmt(dict.resendIn, { s: left }) : dict.resend}
          </Button>
        </div>
      </AuthForm>
    </AuthPanel>
  );
}
