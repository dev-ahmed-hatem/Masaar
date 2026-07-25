import { notFound } from "next/navigation";

import ResetPasswordForm from "@/components/auth/reset-password-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ phone?: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { phone } = await searchParams;
  const d = await getDictionary(locale);
  return <ResetPasswordForm dict={d.auth} locale={locale} phone={phone ?? ""} />;
}
