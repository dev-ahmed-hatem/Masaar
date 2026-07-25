import { notFound } from "next/navigation";

import SignUpForm from "@/components/auth/sign-up-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);
  return <SignUpForm dict={d.auth} locale={locale} />;
}
