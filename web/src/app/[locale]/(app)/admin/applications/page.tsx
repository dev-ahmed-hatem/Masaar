import { notFound } from "next/navigation";

import ApplicationsQueue from "@/components/admin/applications-queue";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return <ApplicationsQueue dict={d.adminApplications} cards={d.stageCards} locale={locale} />;
}
