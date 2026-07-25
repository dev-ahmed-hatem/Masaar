import Link from "next/link";
import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  const cards: { label: string; href?: string }[] = [
    { label: d.admin.teacherBrowser, href: `/${locale}/admin/teachers` },
    { label: d.admin.teachers, href: `/${locale}/admin/applications` },
    { label: d.bookings.adminTitle, href: `/${locale}/admin/bookings` },
    { label: d.admin.receipts, href: `/${locale}/admin/receipts` },
    { label: d.adminReviews.title, href: `/${locale}/admin/reviews` },
    { label: d.admin.payouts, href: `/${locale}/admin/payouts` },
    { label: d.admin.pricing },
  ];

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{d.admin.title}</h1>
          <p className="mt-1 opacity-70">{d.admin.intro}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ label, href }) => {
            const body = (
              <>
                <h2 className="font-medium">{label}</h2>
                <p className="mt-1 text-sm opacity-60">
                  {href ? "Open" : "Coming soon"}
                </p>
              </>
            );
            return href ? (
              <Link
                key={label}
                href={href}
                className="rounded-xl border border-black/10 p-5 transition hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
              >
                {body}
              </Link>
            ) : (
              <div
                key={label}
                className="rounded-xl border border-black/10 p-5 dark:border-white/10"
              >
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </RouteGuard>
  );
}
