import Link from "next/link";
import { notFound } from "next/navigation";

import { dir, isValidLocale, locales, otherLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const d = await getDictionary(locale);
  const other = otherLocale(locale);

  return (
    <div dir={dir(locale)} lang={locale} className="min-h-screen">
      <header className="flex items-center justify-between gap-4 border-b border-black/10 px-6 py-4 dark:border-white/10">
        <Link href={`/${locale}`} className="text-lg font-semibold">
          {d.app.name}
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href={`/${locale}`}>{d.nav.home}</Link>
          <Link href={`/${locale}/teacher`}>{d.nav.teacher}</Link>
          <Link href={`/${locale}/admin`}>{d.nav.admin}</Link>
          <Link
            href={`/${other}`}
            className="rounded-md border border-black/15 px-2 py-1 dark:border-white/20"
          >
            {other === "ar" ? "العربية" : "English"}
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </div>
  );
}
