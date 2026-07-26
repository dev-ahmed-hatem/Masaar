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
    <section className="flex flex-col gap-10">
      <div className="mx-auto max-w-2xl pt-6 text-center sm:pt-12">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
        >
          {d.landing.subtitle}
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl" style={{ color: "var(--ink)" }}>
          {d.app.name}
        </h1>
        <p className="mx-auto mt-4 max-w-prose text-lg" style={{ color: "var(--ink-muted)" }}>
          {d.app.tagline}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/teacher`} className="btn btn-primary">
            {d.landing.teacherCta}
          </Link>
          <Link href={`/${locale}/admin`} className="btn btn-ghost">
            {d.landing.adminCta}
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PortalCard
          href={`/${locale}/teacher`}
          title={d.landing.teacherCta}
          desc={d.teacher.intro}
        />
        <PortalCard
          href={`/${locale}/admin`}
          title={d.landing.adminCta}
          desc={d.admin.intro}
        />
      </div>
    </section>
  );
}

function PortalCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="surface surface-hover group flex flex-col gap-2 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        <span
          className="text-lg transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
          style={{ color: "var(--brand)" }}
        >
          →
        </span>
      </div>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        {desc}
      </p>
    </Link>
  );
}
