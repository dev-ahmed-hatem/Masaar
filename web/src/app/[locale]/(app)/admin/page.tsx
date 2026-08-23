import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  DollarSign,
  FileCheck,
  Layers,
  Star,
  Tags,
  UserCheck,
  Users,
} from "lucide-react";

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

  const cards: { label: string; desc: string; href: string; icon: React.ReactNode }[] = [
    {
      label: d.admin.teacherBrowser,
      desc: d.adminTeachers.intro,
      href: `/${locale}/admin/teachers`,
      icon: <Users size={22} strokeWidth={2.2} />,
    },
    {
      label: d.admin.teachers,
      desc: d.adminApplications.intro,
      href: `/${locale}/admin/applications`,
      icon: <UserCheck size={22} strokeWidth={2.2} />,
    },
    {
      label: d.bookings.adminTitle,
      desc: d.bookings.adminIntro,
      href: `/${locale}/admin/bookings`,
      icon: <CalendarCheck size={22} strokeWidth={2.2} />,
    },
    {
      label: d.admin.receipts,
      desc: d.adminReceipts.intro,
      href: `/${locale}/admin/receipts`,
      icon: <FileCheck size={22} strokeWidth={2.2} />,
    },
    {
      label: d.adminReviews.title,
      desc: d.adminReviews.intro,
      href: `/${locale}/admin/reviews`,
      icon: <Star size={22} strokeWidth={2.2} />,
    },
    {
      label: d.admin.payouts,
      desc: d.adminPayouts.intro,
      href: `/${locale}/admin/payouts`,
      icon: <DollarSign size={22} strokeWidth={2.2} />,
    },
    {
      label: d.admin.pricing,
      desc: d.adminPricing.intro,
      href: `/${locale}/admin/pricing`,
      icon: <Tags size={22} strokeWidth={2.2} />,
    },
    {
      label: d.adminCatalog.title,
      desc: d.adminCatalog.intro,
      href: `/${locale}/admin/catalog`,
      icon: <Layers size={22} strokeWidth={2.2} />,
    },
  ];

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <section className="flex flex-col gap-8">
        <div className="mesh-bg surface overflow-hidden p-7">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            {d.admin.title}
          </h1>
          <p className="mt-1.5 text-base" style={{ color: "var(--ink-muted)" }}>
            {d.admin.intro}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, desc, href, icon }) => (
            <Link
              key={label}
              href={href}
              className="surface surface-hover group flex flex-col gap-3 p-6"
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
                >
                  {icon}
                </span>
                <ArrowRight
                  size={20}
                  className="transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
                  style={{ color: "var(--brand)" }}
                />
              </div>
              <span className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {label}
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                {desc}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </RouteGuard>
  );
}
