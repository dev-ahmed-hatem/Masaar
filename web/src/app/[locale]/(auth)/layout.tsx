import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import ThemeToggle from "@/components/theme-toggle";
import { Logo, WisalSymbol } from "@/components/brand/logo";
import { getDictionary } from "@/i18n/dictionaries";
import { isValidLocale } from "@/i18n/config";

/**
 * Two panels from `lg` up: the brand on one side, the form on the other.
 *
 * The old layout was a 420px antd Card floating on a radial wash — the single
 * most "unbranded SaaS" screen in the app, and the first thing a new student
 * sees. The panel carries the promise (vetted teachers, free trial, money held
 * until the lesson is done); the form side stays narrow and quiet.
 */
export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const d = await getDictionary(isValidLocale(locale) ? locale : "en");
  const points = d.landing.trust;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
      {/* Brand panel */}
      <aside className="pattern-bg relative hidden flex-col justify-between bg-band p-10 text-on-band lg:flex xl:p-14">
        {/* `text-on-band` explicitly: antd's unlayered reset colours every bare
            <a> with colorLink, which beats the inherited on-band white and
            left the mark teal-on-teal. */}
        <Link href={`/${locale}`} aria-label={d.app.name} className="relative w-fit text-on-band">
          <Logo locale={locale} size="md" mono />
        </Link>

        <div className="relative flex max-w-md flex-col gap-7">
          <h2 className="t-h2">{d.app.tagline}</h2>
          <ul className="flex flex-col gap-4">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 t-body">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-on-band/70" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Oversized watermark, cropped by the panel — the mark as texture. */}
        <WisalSymbol
          mono
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -end-16 size-80 text-on-band/[0.07]"
        />
      </aside>

      {/* Form side */}
      <main className="relative flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute end-4 top-4">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-[26rem]">
          <Link
            href={`/${locale}`}
            className="mb-8 flex justify-center lg:hidden"
            aria-label={d.app.name}
          >
            <Logo locale={locale} size="lg" />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
