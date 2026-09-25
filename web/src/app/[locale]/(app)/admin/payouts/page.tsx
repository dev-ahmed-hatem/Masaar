import { notFound } from "next/navigation";

import PayoutsView from "@/components/admin/payouts-view";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminPayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return <PayoutsView dict={d.adminPayouts} locale={locale} />;
}
