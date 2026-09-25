"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import type { AuthDict } from "./fmt";
import { AuthForm, AuthPanel } from "./shell";

export default function ChangePasswordForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const toast = useToast();
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/${locale}/sign-in`);
  }, [loading, user, locale, router]);

  const schema = useMemo(
    () =>
      z
        .object({
          old_password: z.string().min(1, dict.requiredPassword),
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
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { old_password: "", new_password: "", confirm: "" },
  });

  async function onSubmit(values: Values) {
    if (!user) return;
    setSaving(true);
    try {
      await authApi.changePassword(values.old_password, values.new_password);
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      toast.success(dict.changeSuccess);
      router.push(homePathForRole(locale, updated.role));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthPanel
      title={dict.changeTitle}
      subtitle={user?.must_change_password ? dict.changeIntro : undefined}
    >
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <Field
          id="old_password"
          label={dict.currentPassword}
          error={errors.old_password?.message}
          required
        >
          <PasswordInput
            autoComplete="current-password"
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
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

        <Button type="submit" size="lg" block loading={saving}>
          {dict.changeSubmit}
        </Button>
      </AuthForm>
    </AuthPanel>
  );
}
