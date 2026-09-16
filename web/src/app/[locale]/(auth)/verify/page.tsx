import { notFound } from "next/navigation";

import VerifyForm from "@/components/auth/verify-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ phone?: string; to?: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const { phone, to } = await searchParams;
  const d = await getDictionary(locale);
  return <VerifyForm dict={d.auth} locale={locale} phone={phone ?? ""} to={to} />;
}
