import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import FavoritesView from "@/components/students/favorites";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <FavoritesView dict={d.favorites} locale={locale} />
    </RouteGuard>
  );
}
