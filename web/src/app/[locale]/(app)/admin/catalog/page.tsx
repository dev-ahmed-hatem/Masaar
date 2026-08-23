import { notFound } from "next/navigation";

import CatalogView from "@/components/admin/catalog-view";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <CatalogView dict={d.adminCatalog} locale={locale} />
    </RouteGuard>
  );
}
