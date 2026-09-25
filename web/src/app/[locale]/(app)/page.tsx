import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CalendarClock,
  Check,
  GraduationCap,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";

import LandingActions from "@/components/landing-actions";
import FeaturedTeachers from "@/components/landing/featured-teachers";
import HeroSearch from "@/components/landing/hero-search";
import LandingReviews from "@/components/landing/landing-reviews";
import StatsStrip from "@/components/landing/stats-strip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const STEP_ICONS = [Search, CalendarCheck, GraduationCap];
const PRICING_ICONS = [Tag, Sparkles, Wallet];
const SAFETY_ICONS = [BadgeCheck, ReceiptText, CalendarClock];

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
    <div className="flex flex-col gap-20 sm:gap-28">
      {/* ---------- Hero ---------- */}
      <section className="pattern-bg grid items-center gap-10 rounded-hero py-4 lg:grid-cols-2 lg:gap-14 lg:py-8">
        <div>
          <span className="inline-block rounded-pill bg-brand-tint px-3.5 py-1.5 t-caption font-semibold text-on-brand-tint">
            {L.subtitle}
          </span>

          <h1 className="t-display mt-6 max-w-xl text-ink">
            {L.heroLead} <span className="text-brand">{L.heroAccent}</span>
          </h1>

          <p className="mt-5 max-w-lg t-body-lg text-ink-muted">{L.heroSub}</p>

          <HeroSearch locale={locale} dict={L.search} />

          <LandingActions locale={locale} signUp={d.auth.signUp} signIn={d.auth.signIn} />

          <ul className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {L.trust.map((t) => (
              <li key={t} className="flex items-center gap-2 t-small text-ink-muted">
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <Image
            src="/images/landing/hero.webp"
            alt=""
            width={960}
            height={720}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="max-h-[460px] w-full rounded-hero border border-border object-cover shadow-lg"
          />
        </div>
      </section>

      {/* ---------- Real counts, straight from the API ---------- */}
      <StatsStrip locale={locale} dict={L.stats} />

      {/* ---------- How it works ---------- */}
      <section className="flex flex-col gap-8">
        <SectionHead title={L.steps.title} subtitle={L.steps.subtitle} />
        <ol className="grid gap-4 sm:grid-cols-3">
          {L.steps.items.map((item, i) => {
            const Icon = STEP_ICONS[i] ?? Search;
            return (
              <li key={item.title}>
                <Card className="flex h-full flex-col gap-3 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex size-11 items-center justify-center rounded-card bg-brand-tint text-brand">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="font-display text-2xl font-bold text-ink-faint" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="t-h4 text-ink">{item.title}</h3>
                  <p className="t-small text-ink-muted">{item.desc}</p>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ---------- Featured teachers (live) ---------- */}
      <FeaturedTeachers locale={locale} dict={L.featured} browse={d.browse} />

      {/* ---------- Popular subjects ---------- */}
      <section className="flex flex-col gap-8">
        <SectionHead title={L.subjects.title} subtitle={L.subjects.subtitle} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {L.subjects.items.map((s, i) => (
            <li key={s.name}>
              <Link href={`/${locale}/teachers`} className="block h-full">
                <Card interactive className="h-full overflow-hidden">
                  <div className="relative h-36 overflow-hidden">
                    <Image
                      src={SUBJECT_IMAGES[i] ?? SUBJECT_IMAGES[0]}
                      alt=""
                      width={560}
                      height={288}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="size-full object-cover"
                    />
                    {/* Warm wash so six unrelated stock photos read as one set.
                        Replace with the commissioned MENA set when it lands. */}
                    <span aria-hidden className="absolute inset-0 bg-band/30 mix-blend-multiply" />
                  </div>
                  <div className="p-4">
                    <h3 className="t-h4 text-ink">{s.name}</h3>
                    <p className="mt-0.5 t-small text-ink-muted">{s.caption}</p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- How pricing works ---------- */}
      <section className="flex flex-col gap-8">
        <SectionHead title={L.pricing.title} subtitle={L.pricing.subtitle} />
        <ul className="grid gap-4 sm:grid-cols-3">
          {L.pricing.items.map((item, i) => {
            const Icon = PRICING_ICONS[i] ?? Tag;
            return (
              <li key={item.title}>
                <Card className="flex h-full flex-col gap-3 p-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-card bg-accent-tint text-accent-text">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="t-h4 text-ink">{item.title}</h3>
                  <p className="t-small text-ink-muted">{item.desc}</p>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="t-small text-ink-faint">{L.pricing.note}</p>
      </section>

      {/* ---------- Trust & safety ---------- */}
      <section className="flex flex-col gap-8 rounded-hero bg-surface-2 p-6 sm:p-10">
        <SectionHead title={L.safety.title} subtitle={L.safety.subtitle} />
        <ul className="grid gap-6 sm:grid-cols-3">
          {L.safety.items.map((item, i) => {
            const Icon = SAFETY_ICONS[i] ?? ShieldCheck;
            return (
              <li key={item.title} className="flex flex-col gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-card bg-surface text-brand shadow-sm">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="t-h4 text-ink">{item.title}</h3>
                <p className="t-small text-ink-muted">{item.desc}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---------- Reviews (live) ---------- */}
      <LandingReviews dict={L.reviews} />

      {/* ---------- Teach on Wisal ---------- */}
      <section className="grid items-center gap-8 rounded-hero border border-border bg-surface p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <span className="t-overline text-brand">{L.teach.eyebrow}</span>
          <h2 className="t-h2 mt-2 text-ink">{L.teach.title}</h2>
          <p className="mt-3 max-w-xl t-body text-ink-muted">{L.teach.desc}</p>
          <Link href={`/${locale}/become-a-teacher`} className="btn btn-primary mt-7 inline-flex">
            {L.teach.button}
            <ArrowRight size={18} className="rtl:-scale-x-100" />
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {L.teach.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 t-small text-ink">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-tint text-success">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="flex flex-col gap-6">
        <SectionHead title={L.faq.title} />
        <Accordion
          type="single"
          collapsible
          className="rounded-card border border-border bg-surface px-5"
        >
          {L.faq.items.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ---------- Final CTA ----------
          Inverted slab on --band-bg, which stays a deep teal in BOTH themes:
          --brand lifts to #34B9A4 in dark and white on that is only 2.4:1. */}
      <section className="relative overflow-hidden rounded-hero bg-band px-6 py-14 text-center shadow-md sm:px-12">
        <h2 className="t-h2 mx-auto max-w-2xl text-on-band">{L.cta.title}</h2>
        <p className="mx-auto mt-4 max-w-md t-body-lg text-on-band">{L.cta.desc}</p>
        <Link
          href={`/${locale}/sign-up`}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-control bg-white px-7 font-semibold text-band transition-transform motion-safe:hover:-translate-y-0.5"
        >
          {L.cta.button}
          <ArrowRight size={18} className="rtl:-scale-x-100" />
        </Link>
      </section>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="t-h2 text-ink">{title}</h2>
      {subtitle ? <p className="mt-3 t-body text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
