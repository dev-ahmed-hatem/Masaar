import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import StudentLessons from "@/components/students/lessons";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function LessonsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <StudentLessons dict={d.myLessons} bookingsDict={d.bookings} locale={locale} />
    </RouteGuard>
  );
}
