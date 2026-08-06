import { notFound } from "next/navigation";

import StudentBrowse from "@/components/students/browse";
import StudentShell from "@/components/students/shell";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeachersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);
  return (
    <StudentShell active="teachers" nav={d.nav} locale={locale}>
      <StudentBrowse dict={d.browse} locale={locale} />
    </StudentShell>
  );
}
