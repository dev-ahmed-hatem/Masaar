import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import ProfileEditor from "@/components/teacher/profile-editor";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <ProfileEditor dict={d.teacherProfile} locale={locale} />
    </RouteGuard>
  );
}
