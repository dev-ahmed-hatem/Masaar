import { notFound } from "next/navigation";

import ForgotPasswordForm from "@/components/auth/forgot-password-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);
  return <ForgotPasswordForm dict={d.auth} locale={locale} />;
}
