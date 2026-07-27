import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold" style={{ color: "var(--brand)" }}>
          404
        </p>
        <h1 className="mt-3 text-xl font-semibold" style={{ color: "var(--ink)" }}>
          Page not found · الصفحة غير موجودة
        </h1>
        <Link href="/" className="btn btn-primary mt-6 inline-block">
          Home · الرئيسية
        </Link>
      </div>
    </div>
  );
}
