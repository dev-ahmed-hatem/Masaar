import Link from "next/link";
import { notFound } from "next/navigation";

import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">{d.app.name}</h1>
        <p className="mt-1 text-lg opacity-70">{d.landing.subtitle}</p>
        <p className="mt-3 max-w-prose opacity-80">{d.app.tagline}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/${locale}/teacher`}
          className="rounded-lg bg-foreground px-4 py-2 text-background"
        >
          {d.landing.teacherCta}
        </Link>
        <Link
          href={`/${locale}/admin`}
          className="rounded-lg border border-black/15 px-4 py-2 dark:border-white/20"
        >
          {d.landing.adminCta}
        </Link>
      </div>
    </section>
  );
}
