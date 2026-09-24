import Link from "next/link";

import ThemeToggle from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="mesh-bg relative grid min-h-screen place-items-center px-4 py-12">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <Link href={`/${locale}`} className="mb-7 flex justify-center" aria-label="Wisal">
          <Logo locale={locale} size="lg" />
        </Link>
        {children}
      </div>
    </div>
  );
}
