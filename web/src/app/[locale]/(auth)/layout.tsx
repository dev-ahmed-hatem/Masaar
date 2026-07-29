import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="mesh-bg grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full" style={{ maxWidth: 420 }}>
        <Link
          href={`/${locale}`}
          className="mb-7 flex items-center justify-center gap-2.5 text-2xl font-bold"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--grad-brand)", boxShadow: "var(--glow)" }}
          >
            <GraduationCap size={20} strokeWidth={2.4} />
          </span>
          Masaar
        </Link>
        {children}
      </div>
    </div>
  );
}
