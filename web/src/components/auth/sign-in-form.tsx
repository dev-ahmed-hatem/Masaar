"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole, storeSession } from "@/lib/auth";
import { toE164 } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/toast";

import CountryPhoneFields from "./country-phone-fields";
import type { AuthDict } from "./fmt";
import { AuthForm, AuthPanel } from "./shell";

export default function SignInForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const toast = useToast();
  const router = useRouter();
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        market: z.string().min(1, dict.requiredCountry),
        phone: z.string().trim().min(1, dict.requiredPhone),
        password: z.string().min(1, dict.requiredPassword),
      }),
    [dict],
  );
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { market: "", phone: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    const phone = toE164(values.phone, values.market);
    try {
      const res = await authApi.login(phone, values.password);
      storeSession(res);
      setUser(res.user);
      router.push(
        res.user.must_change_password
          ? `/${locale}/change-password`
          : homePathForRole(locale, res.user.role),
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "phone_not_verified") {
        try {
          await authApi.resend(phone, "VERIFY");
        } catch {
          /* ignore */
        }
        router.push(`/${locale}/verify?phone=${encodeURIComponent(phone)}`);
        return;
      }
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel
      title={dict.signInTitle}
      footer={
        <>
          {dict.noAccount}{" "}
          <Link href={`/${locale}/sign-up`} className="link-brand font-semibold">
            {dict.signUp}
          </Link>
        </>
      }
    >
      <AuthForm onSubmit={handleSubmit(onSubmit)}>
        <CountryPhoneFields
          dict={dict}
          locale={locale}
          market={watch("market")}
          onMarketChange={(code) =>
            setValue("market", code ?? "", { shouldValidate: Boolean(code) })
          }
          phoneProps={register("phone")}
          marketError={errors.market?.message}
          phoneError={errors.phone?.message}
        />

        <Field id="password" label={dict.password} error={errors.password?.message} required>
          <PasswordInput
            autoComplete="current-password"
            showLabel={dict.showPassword}
            hideLabel={dict.hidePassword}
            {...register("password")}
          />
        </Field>

        <div className="-mt-1 text-end">
          <Link href={`/${locale}/forgot-password`} className="link-brand t-small font-semibold">
            {dict.forgotPassword}
          </Link>
        </div>

        <Button type="submit" size="lg" block loading={loading}>
          {dict.signIn}
        </Button>
      </AuthForm>
    </AuthPanel>
  );
}
