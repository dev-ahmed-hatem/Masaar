import { notFound } from "next/navigation";
import { CalendarClock, ShieldCheck, Wallet } from "lucide-react";

import LandingActions from "@/components/landing-actions";
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
        <LandingActions locale={locale} signUp={d.auth.signUp} signIn={d.auth.signIn} />
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
    </section>
  );
}
