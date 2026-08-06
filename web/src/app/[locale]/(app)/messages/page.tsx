import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import StudentShell from "@/components/students/shell";
import MessagesView from "@/components/teacher/messages-view";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function StudentMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT"]}>
      <StudentShell active="messages" nav={d.nav} locale={locale}>
        <MessagesView dict={d.chat} locale={locale} />
      </StudentShell>
    </RouteGuard>
  );
}
