import { notFound } from "next/navigation";

import AppHeader from "@/components/app-header";
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
        home={d.nav.home}
        teacher={d.nav.teacher}
        admin={d.nav.admin}
        otherHref={`/${other}`}
        otherLabel={other === "ar" ? "العربية" : "English"}
        signIn={d.auth.signIn}
        signOut={d.auth.signOut}
        bell={d.notifications}
      />
      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px]"
          style={{
            background:
              "radial-gradient(50% 60% at 15% 0%, rgba(109,94,252,0.10), transparent 70%), radial-gradient(45% 55% at 90% 0%, rgba(34,211,238,0.10), transparent 72%)",
          }}
        />
        {children}
      </main>
    </>
  );
}
