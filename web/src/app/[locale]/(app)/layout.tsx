import { notFound } from "next/navigation";

import AppHeader from "@/components/app-header";
import MobileTabBar from "@/components/mobile-tab-bar";
import { isValidLocale, otherLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AppLayout({
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
    <>
      <AppHeader
        locale={locale}
        brand={d.app.name}
        nav={d.nav}
        otherLabel={other === "ar" ? "العربية" : "English"}
        signIn={d.auth.signIn}
        signOut={d.auth.signOut}
        bell={d.notifications}
      />
      <main className="relative mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-12">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px]"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--brand) 7%, transparent), transparent 70%)",
          }}
        />
        {children}
      </main>
      <MobileTabBar locale={locale} nav={d.nav} />
    </>
  );
}
