"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { catalog, catalogName, type Stage } from "@/lib/catalog";
import { listSubjects, type SubjectSummary } from "@/lib/teachers";

type Dict = Dictionary["landing"]["search"];

const ANY = "any";

/**
 * Hero search. Deep-links into /teachers with the chosen stage and subject
 * pre-applied — the listing reads both from the query string.
 *
 * The catalog lists are public, but if they fail to load (API down, first
 * paint) the control degrades to a plain "Find teachers" button rather than
 * showing empty dropdowns. A search box that cannot search is worse than none.
 */
export default function HeroSearch({ locale, dict }: { locale: string; dict: Dict }) {
  const router = useRouter();
  const [stages, setStages] = useState<Stage[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [stage, setStage] = useState(ANY);
  const [subject, setSubject] = useState(ANY);

  useEffect(() => {
    let alive = true;
    Promise.all([catalog.listStages(), listSubjects()])
      .then(([v, s]) => {
        if (!alive) return;
        setStages(v.filter((x) => x.is_active));
        setSubjects(s);
      })
      .catch(() => {
        /* Degrade to the plain CTA below. */
      });
    return () => {
      alive = false;
    };
  }, []);

  const go = () => {
    const qs = new URLSearchParams();
    if (stage !== ANY) qs.set("stage", stage);
    if (subject !== ANY) qs.set("subject", subject);
    const q = qs.toString();
    router.push(`/${locale}/teachers${q ? `?${q}` : ""}`);
  };

  const ready = stages.length > 0 || subjects.length > 0;

  return (
    <div className="mt-8 rounded-panel border border-border bg-surface p-3 shadow-md">
      <p className="px-1 pb-2 t-caption font-semibold text-ink-muted">{dict.title}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        {ready ? (
          <>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger aria-label={dict.subject} className="sm:flex-1">
                <SelectValue placeholder={dict.anySubject} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{dict.anySubject}</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {locale === "ar" ? s.name_ar : s.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger aria-label={dict.stage} className="sm:w-52">
                <SelectValue placeholder={dict.anyStage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{dict.anyStage}</SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {catalogName(s, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}

        {/* The one amber moment in the first viewport. */}
        <Button variant="accent" size="md" onClick={go} className="sm:w-auto">
          <Search aria-hidden />
          {dict.cta}
        </Button>
      </div>
    </div>
  );
}
