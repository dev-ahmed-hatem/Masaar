import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  GraduationCap,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import LandingActions from "@/components/landing-actions";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const FEATURE_ICONS = [ShieldCheck, CalendarClock, Wallet];
const STEP_ICONS = [Search, CalendarCheck, GraduationCap];
const SUBJECT_IMAGES = [
  "/images/landing/subject-math.webp",
  "/images/landing/subject-english.webp",
  "/images/landing/subject-physics.webp",
  "/images/landing/subject-chemistry.webp",
  "/images/landing/subject-arabic.webp",
  "/images/landing/subject-programming.webp",
];

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);
  const L = d.landing;

  return (
    <section className="flex flex-col gap-20 sm:gap-24">
      {/* ---------- Hero ---------- */}
      <div className="mesh-bg grid items-center gap-10 rounded-3xl py-4 lg:grid-cols-2 lg:gap-14 lg:py-8">
        <div>
          <span
            className="inline-block rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide"
            style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
          >
            {L.subtitle}
          </span>
          <h1
            className="mt-6 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            {L.heroLead}{" "}
            <span style={{ color: "var(--brand)" }}>{L.heroAccent}</span>
          </h1>
          <p
            className="mt-5 max-w-lg text-lg leading-relaxed"
            style={{ color: "var(--ink-muted)" }}
          >
            {L.heroSub}
          </p>
          <LandingActions locale={locale} signUp={d.auth.signUp} signIn={d.auth.signIn} />
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {L.trust.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--ink-muted)" }}>
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="relative overflow-hidden rounded-3xl"
          style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/landing/hero.webp"
            alt=""
            width={960}
            height={720}
            className="h-full max-h-[440px] w-full object-cover"
          />
        </div>
      </div>

      {/* ---------- How it works ---------- */}
      <div>
        <SectionHead title={L.steps.title} subtitle={L.steps.subtitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {L.steps.items.map((s, i) => {
            const Icon = STEP_ICONS[i] ?? Search;
            return (
              <div key={s.title} className="surface flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                    style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: "var(--ink-faint)", fontFamily: "var(--font-display)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--ink-muted)" }}>
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Popular subjects ---------- */}
      <div>
        <SectionHead title={L.subjects.title} subtitle={L.subjects.subtitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {L.subjects.items.map((s, i) => (
            <div key={s.name} className="surface surface-hover overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={SUBJECT_IMAGES[i] ?? SUBJECT_IMAGES[0]}
                alt=""
                width={480}
                height={360}
                loading="lazy"
                className="h-36 w-full object-cover"
              />
              <div className="flex flex-col gap-1 p-5">
                <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  {s.name}
                </h3>
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {s.caption}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Features ---------- */}
      <div>
        <SectionHead title={L.featuresTitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {L.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i] ?? ShieldCheck;
            return (
              <div key={f.title} className="surface flex flex-col gap-4 p-6">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "var(--brand-tint)", color: "var(--brand)" }}
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

      {/* ---------- Final CTA ---------- */}
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12"
        style={{ background: "var(--brand)", boxShadow: "var(--shadow-md)" }}
      >
        <h2
          className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ color: "#fff", fontFamily: "var(--font-display)" }}
        >
          {L.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "rgba(255,255,255,0.85)" }}>
          {L.cta.desc}
        </p>
        <Link
          href={`/${locale}/sign-up`}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 font-semibold transition-transform hover:-translate-y-0.5"
          style={{ background: "#fff", color: "var(--brand-dark)" }}
        >
          {L.cta.button}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </Link>
      </div>

      {/* ---------- Footer ---------- */}
      <footer
        className="flex flex-col items-center gap-3 pt-4 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div
          className="mt-8 flex items-center gap-2.5 text-lg font-bold"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--grad-brand)" }}
          >
            <GraduationCap size={18} strokeWidth={2.4} />
          </span>
          {d.app.name}
        </div>
        <p className="max-w-md text-sm" style={{ color: "var(--ink-muted)" }}>
          {L.footer.tagline}
        </p>
        <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
          {L.footer.rights}
        </p>
      </footer>
    </section>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <h2
        className="text-2xl font-bold tracking-tight sm:text-3xl"
        style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-base" style={{ color: "var(--ink-muted)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
