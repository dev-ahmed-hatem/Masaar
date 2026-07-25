import { notFound } from "next/navigation";

import EarningsView from "@/components/teacher/earnings-view";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherEarningsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <EarningsView dict={d.teacherEarnings} />
    </RouteGuard>
  );
}
