import { notFound } from "next/navigation";

import PricingView from "@/components/admin/pricing-view";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminPricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <PricingView dict={d.adminPricing} locale={locale} />
    </RouteGuard>
  );
}
