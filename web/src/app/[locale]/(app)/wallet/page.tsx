import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import WalletView from "@/components/students/wallet";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <WalletView dict={d.wallet} locale={locale} />
    </RouteGuard>
  );
}
