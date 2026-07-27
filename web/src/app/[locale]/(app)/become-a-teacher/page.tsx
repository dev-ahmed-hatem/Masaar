import { notFound } from "next/navigation";

import BecomeTeacherForm from "@/components/apply/become-teacher-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function BecomeATeacherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);
  return <BecomeTeacherForm dict={d.apply} locale={locale} />;
}
