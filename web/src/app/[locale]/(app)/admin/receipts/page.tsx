import { notFound } from "next/navigation";

import ReceiptsQueue from "@/components/admin/receipts-queue";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminReceiptsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return <ReceiptsQueue dict={d.adminReceipts} locale={locale} />;
}
