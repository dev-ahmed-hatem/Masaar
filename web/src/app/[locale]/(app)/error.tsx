"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
        Something went wrong · حدث خطأ ما
      </h1>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        {error.message}
      </p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        Try again · إعادة المحاولة
      </button>
    </div>
  );
}
