import { notFound } from "next/navigation";

import ReviewsModeration from "@/components/admin/reviews-moderation";
import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <ReviewsModeration dict={d.adminReviews} locale={locale} />
    </RouteGuard>
  );
}
