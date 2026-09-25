import { Suspense } from "react";
import { notFound } from "next/navigation";

import GoogleCallback from "@/components/integrations/google-callback";
import { Skeleton } from "@/components/ui/skeleton";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function GoogleCallbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["STUDENT", "TEACHER"]}>
      <Suspense fallback={<Skeleton className="mx-auto h-40 max-w-md rounded-card" />}>
        <GoogleCallback dict={d.googleCalendar} locale={locale} />
      </Suspense>
    </RouteGuard>
  );
}
