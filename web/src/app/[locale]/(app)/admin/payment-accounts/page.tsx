import { notFound } from "next/navigation";

import PaymentAccountsView from "@/components/admin/payment-accounts-view";
import RouteGuard from "@/components/route-guard";
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

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <PaymentAccountsView dict={d.adminPaymentAccounts} locale={locale} />
    </RouteGuard>
  );
}
