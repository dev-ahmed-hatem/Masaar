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
    { label: d.teacher.availability },
    { label: d.teacher.lessons },
    { label: d.teacher.earnings },
  ];

  return (
    <RouteGuard locale={locale} allow={["TEACHER"]}>
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{d.teacher.title}</h1>
          <p className="mt-1 opacity-70">{d.teacher.intro}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cards.map(({ label, href }) => {
            const body = (
              <>
                <h2 className="font-medium">{label}</h2>
                <p className="mt-1 text-sm opacity-60">{href ? "Open" : "Coming soon"}</p>
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
