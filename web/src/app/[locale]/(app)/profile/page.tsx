import { Suspense } from "react";
import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import ProfileView from "@/components/students/profile";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <Suspense fallback={null}>
        <ProfileView dict={d.profile} gcal={d.googleCalendar} locale={locale} />
      </Suspense>
    </RouteGuard>
  );
}
