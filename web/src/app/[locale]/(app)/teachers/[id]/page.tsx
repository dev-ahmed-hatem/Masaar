import { notFound } from "next/navigation";

import TeacherDetail from "@/components/students/teacher-detail";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isValidLocale(locale)) notFound();
  const teacherId = Number(id);
  if (!Number.isInteger(teacherId)) notFound();
  const d = await getDictionary(locale);
  return <TeacherDetail id={teacherId} dict={d.browse} locale={locale} />;
}
