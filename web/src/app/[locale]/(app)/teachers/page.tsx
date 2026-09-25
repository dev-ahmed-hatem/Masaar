import { notFound } from "next/navigation";

import StudentBrowse from "@/components/students/browse";
import { isValidLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** Parse a positive integer query param, ignoring anything malformed. */
function num(v: string | string[] | undefined): number | undefined {
  const raw = Array.isArray(v) ? v[0] : v;
  const n = Number(raw);
  return raw && Number.isInteger(n) && n > 0 ? n : undefined;
}

export default async function TeachersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const d = await getDictionary(locale);

  // Read the filters here rather than with useSearchParams in the client
  // component: the server already knows them, so the first paint is already
  // filtered and there is no Suspense boundary or hydration mismatch to manage.
  const sp = await searchParams;

  return (
    <StudentBrowse
      dict={d.browse}
      locale={locale}
      initialStage={num(sp.stage)}
      initialSubject={num(sp.subject)}
      initialName={typeof sp.q === "string" ? sp.q : undefined}
    />
  );
}
