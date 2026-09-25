import { notFound } from "next/navigation";

import AdminAntdProvider from "@/components/admin/antd-provider";
import AdminNav from "@/components/admin/admin-nav";
import { adminSections } from "@/components/admin/sections";
import RouteGuard from "@/components/route-guard";
import { dir, isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/**
 * The moderator shell: one role guard, one antd mount, one sidebar.
 *
 * The guard and the provider used to be repeated in each of the ten admin
 * pages / the root layout respectively; here they cover the whole subtree, and
 * antd is code-split with it.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <RouteGuard locale={locale} allow={["MODERATOR", "SUPERADMIN"]}>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10">
        <AdminNav
          overviewHref={`/${locale}/admin`}
          overviewLabel={d.nav.overview}
          sections={adminSections(d, locale)}
        />
        <div className="min-w-0">
          <AdminAntdProvider direction={dir(locale)} locale={locale}>
            {children}
          </AdminAntdProvider>
        </div>
      </div>
    </RouteGuard>
  );
}
