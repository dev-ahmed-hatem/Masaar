"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { toE164 } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

import CountryPhoneFields from "./country-phone-fields";
import type { AuthDict } from "./fmt";
import { AuthForm, AuthPanel } from "./shell";

export default function ForgotPasswordForm({
  dict,
  locale,
}: {
  dict: AuthDict;
  locale: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const emailOtp = useOtpChannel() === "email";

  const schema = useMemo(
    () =>
      z.object({
        market: z.string().min(1, dict.requiredCountry),
        phone: z.string().trim().min(1, dict.requiredPhone),
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
    defaultValues: { market: "", phone: "" },
  });

  async function onSubmit(values: Values) {
    setLoading(true);
    const phone = toE164(values.phone, values.market);
    try {
      await authApi.resetRequest(phone);
      toast.success(dict.resetSent);
      router.push(`/${locale}/reset-password?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPanel
      title={dict.forgotTitle}
      subtitle={emailOtp ? dict.forgotIntroEmail : dict.forgotIntro}
      footer={
        <Link href={`/${locale}/sign-in`} className="link-brand font-semibold">
          {dict.backToSignIn}
        </Link>
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
        <Button type="submit" size="lg" block loading={loading}>
          {dict.sendResetCode}
        </Button>
      </AuthForm>
    </AuthPanel>
  );
}
