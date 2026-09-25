import { notFound } from "next/navigation";

import BookingsView from "@/components/admin/bookings-view";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminBookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return <BookingsView dict={d.bookings} locale={locale} />;
}
