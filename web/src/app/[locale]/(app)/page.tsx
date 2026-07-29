import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarClock, GraduationCap, ShieldCheck, Wallet } from "lucide-react";

import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const FEATURE_ICONS = [ShieldCheck, CalendarClock, Wallet];

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <section className="flex flex-col gap-14">
      {/* Hero */}
      <div className="mesh-bg surface relative overflow-hidden px-6 py-16 text-center sm:px-10 sm:py-20">
        <span
          className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold"
          style={{ background: "var(--brand-tint)", color: "var(--brand-dark)" }}
        >
          {d.landing.subtitle}
        </span>
        <h1
          className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          {d.landing.heroLead}
          <span className="gradient-text"> {d.app.name}</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg" style={{ color: "var(--ink-muted)" }}>
          {d.landing.heroSub}
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href={`/${locale}/become-a-teacher`} className="btn btn-primary">
            {d.landing.applyCta}
            <ArrowRight size={18} className="rtl:-scale-x-100" />
          </Link>
          <Link href={`/${locale}/teacher`} className="btn btn-ghost">
            {d.landing.teacherCta}
          </Link>
        </div>
      </div>

      {/* Features */}
      <div>
        <h2
          className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          {d.landing.featuresTitle}
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {d.landing.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
            return (
              <div key={f.title} className="surface surface-hover flex flex-col gap-4 p-6">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
                >
                  <Icon size={22} strokeWidth={2.2} />
                </span>
                <h3 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Portals */}
      <div>
        <h2
          className="text-xl font-bold tracking-tight"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          {d.landing.portalsTitle}
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <PortalCard
            href={`/${locale}/teacher`}
            title={d.landing.teacherCta}
            desc={d.teacher.intro}
            icon={<GraduationCap size={22} strokeWidth={2.2} />}
          />
          <PortalCard
            href={`/${locale}/admin`}
            title={d.landing.adminCta}
            desc={d.admin.intro}
            icon={<ShieldCheck size={22} strokeWidth={2.2} />}
          />
        </div>
      </div>
    </section>
  );
}

function PortalCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="surface surface-hover group flex items-center gap-4 p-6">
      <span
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {title}
        </h3>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {desc}
        </p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
        style={{ color: "var(--brand)" }}
      />
    </Link>
  );
}
