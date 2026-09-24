import { notFound } from "next/navigation";

import AppHeader from "@/components/app-header";
import MobileTabBar from "@/components/mobile-tab-bar";
import SiteFooter from "@/components/site-footer";
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
  const p = (path: string) => `/${locale}/${path}`;

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
        {children}
      </main>
      <SiteFooter
        locale={locale}
        tagline={d.landing.footer.tagline}
        rights={d.landing.footer.rights}
        craftedBy={d.landing.footer.craftedBy}
        columns={[
          {
            title: d.landing.footer.forStudents,
            links: [
              { label: d.nav.browse, href: p("teachers") },
              { label: d.auth.signUp, href: p("sign-up") },
              { label: d.auth.signIn, href: p("sign-in") },
            ],
          },
          {
            title: d.landing.footer.forTeachers,
            links: [{ label: d.nav.apply, href: p("become-a-teacher") }],
          },
        ]}
      />
      <MobileTabBar locale={locale} nav={d.nav} />
    </>
  );
}
