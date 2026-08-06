import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import StudentDashboard from "@/components/students/dashboard";
import StudentShell from "@/components/students/shell";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <StudentShell active="overview" nav={d.nav} locale={locale}>
        <StudentDashboard dict={d.dashboard} locale={locale} />
      </StudentShell>
    </RouteGuard>
  );
}
