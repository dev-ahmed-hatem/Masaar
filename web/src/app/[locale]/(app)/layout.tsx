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
      />
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
    </>
  );
}
