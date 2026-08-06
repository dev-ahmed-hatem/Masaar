import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BecomeTeacherForm from "@/components/apply/become-teacher-form";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

// Unlisted: teachers are onboarded privately, so keep this page out of search
// indexes. It is reachable only via a URL shared directly with contacted teachers.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
