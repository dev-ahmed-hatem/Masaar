import Link from "next/link";

export default async function AuthLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-12"
      style={{
        background:
          "radial-gradient(1100px 500px at 50% -10%, var(--brand-tint) 0%, var(--bg) 60%)",
      }}
    >
      <div className="w-full" style={{ maxWidth: 420 }}>
        <Link
          href={`/${locale}`}
          className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold"
          style={{ color: "var(--ink)" }}
        >
          <span
            className="inline-block h-7 w-7 rounded-lg"
            style={{ background: "linear-gradient(135deg, var(--brand) 0%, #12a894 100%)" }}
          />
          Masaar
        </Link>
        {children}
      </div>
    </div>
  );
}
