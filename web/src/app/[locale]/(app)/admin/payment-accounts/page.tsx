import { notFound } from "next/navigation";

import PaymentAccountsView from "@/components/admin/payment-accounts-view";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminPaymentAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return <PaymentAccountsView dict={d.adminPaymentAccounts} locale={locale} />;
}
