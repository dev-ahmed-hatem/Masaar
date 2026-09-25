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

  const direction = dir(locale);

  return (
    <>
      {/*
        The `dir`/`lang` below cover this subtree, but Radix portals dialogs,
        sheets, selects and popovers onto <body> — outside it — so on /ar every
        overlay laid out left-to-right. <html> is owned by the root layout,
        which sits above [locale] and cannot know the locale, so mirror the
        pair onto the document element here. Inline and synchronous: it runs
        before the body paints, like the no-FOUC theme script.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.dir=${JSON.stringify(direction)};document.documentElement.lang=${JSON.stringify(locale)};`,
        }}
      />
      <div dir={direction} lang={locale} className="min-h-screen">
        <Providers direction={direction}>
          {children}
        </Providers>
      </div>
    </>
  );
}
