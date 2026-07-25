import { notFound } from "next/navigation";

import Providers from "@/app/providers";
import { dir, isValidLocale, locales } from "@/i18n/config";

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

  return (
    <div dir={dir(locale)} lang={locale} className="min-h-screen">
      <Providers direction={dir(locale)} locale={locale}>
        {children}
      </Providers>
    </div>
  );
}
