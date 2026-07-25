import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import TeacherBrowser from "@/components/admin/teacher-browser";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminTeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <TeacherBrowser dict={d.adminTeachers} locale={locale} />
    </RouteGuard>
  );
}
