import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import CalendarView from "@/components/teacher/calendar-view";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherCalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <CalendarView dict={d.teacherCalendar} bookingsDict={d.bookings} locale={locale} />
    </RouteGuard>
  );
}
