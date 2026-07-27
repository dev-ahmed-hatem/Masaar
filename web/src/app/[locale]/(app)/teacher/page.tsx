import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import TeacherDashboardView from "@/components/teacher/dashboard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <TeacherDashboardView dict={d.teacherDashboard} locale={locale} />
    </RouteGuard>
  );
}
