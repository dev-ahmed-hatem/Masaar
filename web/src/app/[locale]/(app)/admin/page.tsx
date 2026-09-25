import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { adminSections } from "@/components/admin/sections";
import { Card } from "@/components/ui/card";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  return (
    <section className="flex flex-col gap-7">
      <div className="flex flex-col gap-1.5">
        <h1 className="t-h1 text-ink">{d.admin.title}</h1>
        <p className="max-w-[60ch] t-body-lg text-ink-muted">{d.admin.intro}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {adminSections(d, locale).map(({ label, desc, href, icon }) => (
          <Link key={href} href={href} className="group block">
            <Card interactive className="flex h-full items-start gap-4 p-5">
              <span
                aria-hidden
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-tint text-on-brand-tint [&_svg]:size-5"
              >
                {icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="t-h4 text-ink">{label}</span>
                <span className="t-small text-ink-muted">{desc}</span>
              </div>
              <ArrowRight
                aria-hidden
                className="mt-1 size-4 shrink-0 text-ink-faint transition-colors group-hover:text-brand rtl:-scale-x-100"
              />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
