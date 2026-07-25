import { notFound } from "next/navigation";

import LessonsManager from "@/components/teacher/lessons-manager";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherLessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <LessonsManager dict={d.bookings} locale={locale} />
    </RouteGuard>
  );
}
