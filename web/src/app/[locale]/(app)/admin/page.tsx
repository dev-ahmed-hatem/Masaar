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
      <section className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            {d.admin.title}
          </h1>
          <p className="mt-1.5 text-base" style={{ color: "var(--ink-muted)" }}>
            {d.admin.intro}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, href }) => {
            const body = (
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>
                  {label}
                </span>
                {href ? (
                  <span
                    className="text-lg transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                    style={{ color: "var(--brand)" }}
                  >
                    →
                  </span>
                ) : (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: "var(--bg)", color: "var(--ink-faint)" }}
                  >
                    Soon
                  </span>
                )}
              </div>
            );
            return href ? (
              <Link key={label} href={href} className="surface surface-hover group p-5">
                {body}
              </Link>
            ) : (
              <div key={label} className="surface p-5 opacity-60">
                {body}
              </div>
            );
          })}
        </div>
      </section>
    </RouteGuard>
  );
}
