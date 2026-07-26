import Link from "next/link";
import { notFound } from "next/navigation";

import RouteGuard from "@/components/route-guard";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function TeacherPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  const cards: { label: string; href?: string }[] = [
    { label: d.teacher.profile, href: `/${locale}/teacher/profile` },
    { label: d.teacher.lessons, href: `/${locale}/teacher/lessons` },
    { label: d.teacher.availability, href: `/${locale}/teacher/profile` },
    { label: d.teacher.earnings, href: `/${locale}/teacher/earnings` },
  ];

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <section className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            {d.teacher.title}
          </h1>
          <p className="mt-1.5 text-base" style={{ color: "var(--ink-muted)" }}>
            {d.teacher.intro}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ label, href }) => (
            <Link
              key={label}
              href={href ?? "#"}
              className="surface surface-hover group flex items-center justify-between gap-3 p-5"
            >
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {label}
              </span>
              <span
                className="text-lg transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                style={{ color: "var(--brand)" }}
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </RouteGuard>
  );
}
