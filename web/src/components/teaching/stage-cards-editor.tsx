"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";

import {
  catalog,
  catalogName,
  type Stage,
  type StagePricing,
  type StageSubject,
  type Track,
} from "@/lib/catalog";
import {
  formatMoney,
  type StageCard,
  type StageCardInput,
  type WeeklyWindow,
} from "@/lib/stage-cards";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog, ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import StageCardSummary, { type StageCardsDict } from "./stage-card-summary";

const cardKey = (vertical: number, track: number | null) => `${vertical}|${track ?? 0}`;

/**
 * List of a teacher's stage cards with add / edit / remove. Persistence is up to
 * the parent: `onSave` receives the validated input plus a locally-built preview
 * card (enough to render a draft), and `existing` when editing.
 */
export default function StageCardsEditor({
  dict,
  locale,
  market,
  cards,
  onSave,
  onRemove,
  highlightIds = [],
  disabled = false,
}: {
  dict: StageCardsDict;
  locale: string;
  market: string;
  cards: StageCard[];
  onSave: (input: StageCardInput, preview: StageCard, existing: StageCard | null) => Promise<void>;
  onRemove: (card: StageCard) => Promise<void>;
  highlightIds?: number[];
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<StageCard | "new" | null>(null);
  const [removing, setRemoving] = useState<StageCard | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const takenKeys = useMemo(
    () =>
      new Set(
        cards
          .filter((c) => editing === "new" || !editing || c.id !== editing.id)
          .map((c) => cardKey(c.stage.id, c.track?.id ?? null)),
      ),
    [cards, editing],
  );

  return (
    <div className="flex flex-col gap-3">
      {cards.length === 0 ? (
        <p className="t-small text-ink-muted">{dict.empty}</p>
      ) : (
        cards.map((card) => (
          <StageCardSummary
            key={card.id}
            card={card}
            dict={dict}
            locale={locale}
            highlight={highlightIds.includes(card.id)}
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(card)}
                  disabled={disabled}
                >
                  <Pencil aria-hidden />
                  {dict.edit}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRemoving(card)}
                  disabled={disabled}
                  aria-label={dict.remove}
                  className="text-ink-muted hover:bg-error-tint hover:text-error"
                >
                  <Trash2 aria-hidden />
                </Button>
              </>
            }
          />
        ))
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => setEditing("new")}
        className="self-start"
        disabled={disabled}
      >
        <Plus aria-hidden />
        {dict.addStage}
      </Button>

      {editing ? (
        <StageCardForm
          dict={dict}
          locale={locale}
          market={market}
          card={editing === "new" ? null : editing}
          takenKeys={takenKeys}
          onClose={() => setEditing(null)}
          onSubmit={async (input, preview) => {
            await onSave(input, preview, editing === "new" ? null : editing);
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={dict.remove}
        description={dict.removeConfirm}
        confirmLabel={dict.remove}
        cancelLabel={dict.cancel}
        loading={removeBusy}
        onConfirm={async () => {
          if (!removing) return;
          setRemoveBusy(true);
          try {
            await onRemove(removing);
            setRemoving(null);
          } finally {
            setRemoveBusy(false);
          }
        }}
      />
    </div>
  );
}

/** One availability row. Everything is a string — these are form inputs. */
interface WindowRow {
  weekday: string;
  start: string;
  end: string;
}

interface FormValues {
  vertical: string;
  track: string;
  subjects: number[];
  price: string;
  free_lessons_offered: string;
  availability: WindowRow[];
}

const BLANK_ROW: WindowRow = { weekday: "", start: "", end: "" };
const isBlank = (r: WindowRow) => !r.weekday && !r.start && !r.end;
const isFilled = (r: WindowRow) => Boolean(r.weekday && r.start && r.end);

function toRows(windows: WeeklyWindow[]): WindowRow[] {
  return windows.map((w) => ({
    weekday: String(w.weekday),
    start: w.start_time.slice(0, 5),
    end: w.end_time.slice(0, 5),
  }));
}

function StageCardForm({
  dict,
  locale,
  market,
  card,
  takenKeys,
  onClose,
  onSubmit,
}: {
  dict: StageCardsDict;
  locale: string;
  market: string;
  card: StageCard | null;
  takenKeys: Set<string>;
  onClose: () => void;
  onSubmit: (input: StageCardInput, preview: StageCard) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [rules, setRules] = useState<StagePricing[]>([]);
  // Lookups are tagged with the key they were loaded for, so a stale response
  // (or a changed stage/branch) simply reads as "nothing loaded yet".
  const [tracksFor, setTracksFor] = useState<{ key: number; rows: Track[] } | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<{ key: string; rows: StageSubject[] } | null>(null);

  const defaults: FormValues = card
    ? {
        vertical: String(card.stage.id),
        track: card.track ? String(card.track.id) : "",
        subjects: card.subjects.map((s) => s.id),
        price: (card.price.amount_minor / 100).toFixed(2),
        free_lessons_offered: String(card.free_lessons_offered),
        availability: toRows(card.availability),
      }
    : {
        vertical: "",
        track: "",
        subjects: [],
        price: "",
        free_lessons_offered: "0",
        availability: [BLANK_ROW],
      };

  // The stage/branch choice drives the catalog lookups AND the validation
  // schema, and the schema has to exist before `useForm` — so it is held here
  // rather than read back out of the form.
  const [picked, setPicked] = useState<{ vertical?: number; track?: number }>({
    vertical: card?.stage.id,
    track: card?.track?.id,
  });
  const { vertical: verticalId, track: trackId } = picked;

  const stage = stages.find((s) => s.id === verticalId);
  const needsTrack = stage ? stage.child_kind !== "NONE" : Boolean(card?.track);
  const rule = rules.find((r) => r.vertical === verticalId);
  const minMinor = Math.max(1, rule?.min_price_minor ?? card?.min_price_minor ?? 0);
  const currency = rule?.currency ?? card?.price.currency ?? "";
  const subjectsKey =
    verticalId && (!needsTrack || trackId) ? cardKey(verticalId, needsTrack ? trackId! : null) : null;
  const tracks = tracksFor && tracksFor.key === verticalId ? tracksFor.rows : [];
  const subjects = useMemo(
    () => (subjectsFor && subjectsFor.key === subjectsKey ? subjectsFor.rows : []),
    [subjectsFor, subjectsKey],
  );

  const schema = useMemo(
    () =>
      z
        .object({
          vertical: z.string().min(1, dict.requiredStage),
          track: z.string(),
          subjects: z.array(z.number()).min(1, dict.requiredSubjects),
          price: z.string(),
          free_lessons_offered: z.string(),
          availability: z.array(
            z.object({ weekday: z.string(), start: z.string(), end: z.string() }),
          ),
        })
        .superRefine((v, ctx) => {
          if (needsTrack && !v.track) {
            ctx.addIssue({ code: "custom", path: ["track"], message: dict.requiredTrack });
          }
          // A stage (+ branch) can only be claimed once; ids can't change on an
          // edit, so this only ever fires while adding.
          if (!card && v.vertical && (!needsTrack || v.track)) {
            const key = cardKey(Number(v.vertical), needsTrack ? Number(v.track) : null);
            if (takenKeys.has(key)) {
              ctx.addIssue({
                code: "custom",
                path: [needsTrack ? "track" : "vertical"],
                message: dict.duplicateStage,
              });
            }
          }

          const amount = Number(v.price);
          if (!v.price.trim() || Number.isNaN(amount)) {
            ctx.addIssue({ code: "custom", path: ["price"], message: dict.requiredPrice });
          } else if (Math.round(amount * 100) < minMinor) {
            ctx.addIssue({
              code: "custom",
              path: ["price"],
              message: dict.priceTooLow.replace("{amount}", formatMoney(minMinor, currency)),
            });
          }

          // A half-filled row is a mistake; a wholly empty one is just an
          // unused slot and gets dropped on submit.
          v.availability.forEach((row, i) => {
            if (isBlank(row) || isFilled(row)) return;
            const missing = !row.weekday ? "weekday" : !row.start ? "start" : "end";
            ctx.addIssue({
              code: "custom",
              path: ["availability", i, missing],
              message: dict.requiredAvailabilityRow,
            });
          });

          const filled = v.availability
            .map((row, i) => ({ row, i }))
            .filter(({ row }) => isFilled(row));

          for (const { row, i } of filled) {
            if (row.end <= row.start) {
              ctx.addIssue({
                code: "custom",
                path: ["availability", i, "end"],
                message: dict.endAfterStart,
              });
            }
          }

          // Same-day overlap: sort by start, then compare neighbours. The issue
          // lands on the later row, which is the one the teacher must move.
          const byDay = new Map<string, { row: WindowRow; i: number }[]>();
          for (const entry of filled) {
            const list = byDay.get(entry.row.weekday) ?? [];
            list.push(entry);
            byDay.set(entry.row.weekday, list);
          }
          for (const list of byDay.values()) {
            const sorted = [...list].sort((a, b) => a.row.start.localeCompare(b.row.start));
            for (let i = 1; i < sorted.length; i++) {
              if (sorted[i].row.start < sorted[i - 1].row.end) {
                ctx.addIssue({
                  code: "custom",
                  path: ["availability", sorted[i].i, "start"],
                  message: dict.overlap,
                });
              }
            }
          }
        }),
    [dict, needsTrack, card, takenKeys, minMinor, currency],
  );

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    // The cast keeps `superRefine`'s widened output off the field types.
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: defaults,
  });

  const rows = watch("availability");

  useEffect(() => {
    catalog.listStages().then(setStages).catch(() => setStages([]));
  }, []);

  useEffect(() => {
    catalog.listStagePricing(market).then(setRules).catch(() => setRules([]));
  }, [market]);

  useEffect(() => {
    if (!verticalId || !needsTrack) return;
    catalog
      .listTracks(verticalId)
      .then((rows) => setTracksFor({ key: verticalId, rows }))
      .catch(() => setTracksFor({ key: verticalId, rows: [] }));
  }, [verticalId, needsTrack]);

  useEffect(() => {
    if (!verticalId || !subjectsKey) return;
    const track = needsTrack ? trackId ?? null : null;
    catalog
      .listStageSubjects(verticalId, track)
      // A stage without branches only lists its track-less subjects.
      .then((rows) =>
        setSubjectsFor({ key: subjectsKey, rows: rows.filter((r) => (r.track ?? null) === track) }),
      )
      .catch(() => setSubjectsFor({ key: subjectsKey, rows: [] }));
  }, [verticalId, trackId, needsTrack, subjectsKey]);

  // Keep previously chosen subjects selectable while the catalog loads.
  const subjectOptions = useMemo(() => {
    const opts = new Map<number, string>();
    for (const s of card?.subjects ?? []) opts.set(s.id, locale === "ar" ? s.name_ar : s.name_en);
    for (const ss of subjects)
      opts.set(ss.subject, locale === "ar" ? ss.subject_name_ar : ss.subject_name_en);
    return [...opts].map(([value, label]) => ({ value, label }));
  }, [subjects, card, locale]);

  async function submit(v: FormValues) {
    const vertical = Number(v.vertical) || card!.stage.id;
    const track = needsTrack ? Number(v.track) || card?.track?.id || null : null;
    const windows: WeeklyWindow[] = v.availability.filter(isFilled).map((r) => ({
      weekday: Number(r.weekday),
      start_time: r.start,
      end_time: r.end,
    }));
    const priceMinor = Math.round(Number(v.price) * 100);
    const input: StageCardInput = {
      vertical,
      track,
      subjects: v.subjects,
      price_minor: priceMinor,
      free_lessons_offered: Number(v.free_lessons_offered) || 0,
      availability: windows,
    };

    const stageRow = stages.find((s) => s.id === vertical);
    const trackRow = tracks.find((t) => t.id === track);
    const subjectNames = new Map(
      subjects.map((ss) => [
        ss.subject,
        { id: ss.subject, name_en: ss.subject_name_en, name_ar: ss.subject_name_ar },
      ]),
    );
    for (const s of card?.subjects ?? []) if (!subjectNames.has(s.id)) subjectNames.set(s.id, s);
    const preview: StageCard = {
      id: card?.id ?? -Date.now(),
      stage: stageRow
        ? { id: stageRow.id, name_en: stageRow.name_en, name_ar: stageRow.name_ar }
        : card!.stage,
      track: track
        ? trackRow
          ? { id: trackRow.id, name_en: trackRow.name_en, name_ar: trackRow.name_ar }
          : card?.track ?? null
        : null,
      subjects: input.subjects.map((id) => subjectNames.get(id)).filter((s) => s != null),
      price: { amount_minor: priceMinor, currency, display: formatMoney(priceMinor, currency) },
      free_lessons_offered: input.free_lessons_offered,
      availability: windows,
    };

    setSaving(true);
    try {
      await onSubmit(input, preview);
    } catch {
      // The parent reports the error; keep the dialog open for corrections.
    } finally {
      setSaving(false);
    }
  }

  const trackLabel = stage?.child_kind === "FACULTY" ? dict.faculty : dict.branch;
  const trackPlaceholder = stage?.child_kind === "FACULTY" ? dict.chooseFaculty : dict.chooseBranch;
  const trackOptions =
    card?.track && tracks.length === 0
      ? [{ value: card.track.id, label: locale === "ar" ? card.track.name_ar : card.track.name_en }]
      : tracks.map((t) => ({ value: t.id, label: catalogName(t, locale) }));

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={card ? dict.editStageTitle : dict.newStageTitle}
      className="md:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {dict.cancel}
          </Button>
          <Button type="submit" form="stage-card-form" loading={saving}>
            {dict.save}
          </Button>
        </>
      }
    >
      {/* The submit button lives in the dialog footer, outside this element —
          `form="stage-card-form"` is what still ties them together. */}
      <form
        id="stage-card-form"
        noValidate
        onSubmit={handleSubmit(submit)}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="vertical" label={dict.stage} error={errors.vertical?.message} required>
            <Controller
              control={control}
              name="vertical"
              render={({ field }) => (
                <Select
                  value={field.value}
                  disabled={Boolean(card)}
                  onValueChange={(next) => {
                    field.onChange(next);
                    // Branch and subjects belong to the old stage.
                    setPicked({ vertical: Number(next), track: undefined });
                    setValue("track", "");
                    setValue("subjects", []);
                  }}
                >
                  <SelectTrigger id="vertical">
                    <SelectValue placeholder={dict.chooseStage} />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {catalogName(s, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {needsTrack ? (
            <Field id="track" label={trackLabel} error={errors.track?.message} required>
              <Controller
                control={control}
                name="track"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    disabled={Boolean(card)}
                    onValueChange={(next) => {
                      field.onChange(next);
                      setPicked((prev) => ({ ...prev, track: Number(next) }));
                      setValue("subjects", []);
                    }}
                  >
                    <SelectTrigger id="track">
                      <SelectValue placeholder={trackPlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {trackOptions.map((t) => (
                        <SelectItem key={t.value} value={String(t.value)}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          ) : null}
        </div>

        <Field
          id="subjects"
          label={dict.subjects}
          hint={dict.chooseSubjects}
          error={errors.subjects?.message}
          required
        >
          <Controller
            control={control}
            name="subjects"
            render={({ field }) => (
              <ChipGroup
                id="subjects"
                label={dict.subjects}
                options={subjectOptions}
                value={field.value}
                onChange={field.onChange}
                invalid={Boolean(errors.subjects)}
                disabled={!verticalId || (needsTrack && !trackId)}
              />
            )}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="price"
            label={dict.price}
            hint={verticalId ? dict.minPrice.replace("{amount}", formatMoney(minMinor, currency)) : undefined}
            error={errors.price?.message}
            required
          >
            <Input
              dir="ltr"
              inputMode="decimal"
              endSlot={currency ? <span className="t-small">{currency}</span> : undefined}
              {...register("price")}
            />
          </Field>

          <Field id="free_lessons_offered" label={dict.freeLessons} hint={dict.freeLessonsHint}>
            <Input type="number" min={0} max={10} dir="ltr" {...register("free_lessons_offered")} />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{dict.availability}</Label>
          <p className="t-caption text-ink-muted">{dict.availabilityHint}</p>

          <div className="mt-1 flex flex-col gap-3">
            {rows.map((_, i) => {
              const rowErrors = errors.availability?.[i];
              const message =
                rowErrors?.weekday?.message ?? rowErrors?.start?.message ?? rowErrors?.end?.message;
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Controller
                      control={control}
                      name={`availability.${i}.weekday`}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          {/* Full width on a phone so the two times stay
                              together on the line below, not split by a wrap. */}
                          <SelectTrigger aria-label={dict.day} className="w-full sm:w-36">
                            <SelectValue placeholder={dict.day} />
                          </SelectTrigger>
                          <SelectContent>
                            {dict.weekdays.map((d, index) => (
                              <SelectItem key={d} value={String(index)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        dir="ltr"
                        aria-label={dict.from}
                        className="w-32"
                        {...register(`availability.${i}.start`)}
                      />
                      <span aria-hidden className="text-ink-faint">
                        –
                      </span>
                      <Input
                        type="time"
                        step={900}
                        dir="ltr"
                        aria-label={dict.to}
                        className="w-32"
                        {...register(`availability.${i}.end`)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={dict.remove}
                      className="text-ink-muted hover:bg-error-tint hover:text-error"
                      onClick={() =>
                        setValue(
                          "availability",
                          rows.filter((_, index) => index !== i),
                          { shouldValidate: true },
                        )
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  {message ? (
                    <p role="alert" className="t-caption text-error">
                      {message}
                    </p>
                  ) : null}
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setValue("availability", [...rows, { ...BLANK_ROW }])}
            >
              <Plus aria-hidden />
              {dict.addHours}
            </Button>
          </div>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
