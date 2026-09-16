"use client";

import { useEffect, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  Button,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  TimePicker,
  Typography,
} from "antd";
import { Plus, Trash2 } from "lucide-react";

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

import StageCardSummary, { type StageCardsDict } from "./stage-card-summary";

const { Text } = Typography;

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
  const [removingId, setRemovingId] = useState<number | null>(null);

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
        <Text type="secondary">{dict.empty}</Text>
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
                <Button size="small" onClick={() => setEditing(card)} disabled={disabled}>
                  {dict.edit}
                </Button>
                <Popconfirm
                  title={dict.removeConfirm}
                  okText={dict.remove}
                  cancelText={dict.cancel}
                  onConfirm={async () => {
                    setRemovingId(card.id);
                    try {
                      await onRemove(card);
                    } finally {
                      setRemovingId(null);
                    }
                  }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    loading={removingId === card.id}
                    disabled={disabled}
                    aria-label={dict.remove}
                  />
                </Popconfirm>
              </>
            }
          />
        ))
      )}
      <Button
        icon={<Plus size={15} />}
        onClick={() => setEditing("new")}
        className="self-start"
        disabled={disabled}
      >
        {dict.addStage}
      </Button>

      {editing && (
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
      )}
    </div>
  );
}

interface WindowRow {
  weekday?: number;
  range?: [Dayjs | null, Dayjs | null] | null;
}

interface FormValues {
  vertical?: number;
  track?: number;
  subjects?: number[];
  price?: number | null;
  free_lessons_offered?: number | null;
  availability?: WindowRow[];
}

/** "HH:MM" -> today's date at that time (dayjs can't parse a bare time string). */
function timeOfDay(hhmm: string): Dayjs {
  const [h, m] = hhmm.split(":").map(Number);
  return dayjs().hour(h).minute(m).second(0).millisecond(0);
}

function toRows(windows: WeeklyWindow[]): WindowRow[] {
  return windows.map((w) => ({
    weekday: w.weekday,
    range: [timeOfDay(w.start_time), timeOfDay(w.end_time)],
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
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [rules, setRules] = useState<StagePricing[]>([]);
  // Lookups are tagged with the key they were loaded for, so a stale response
  // (or a changed stage/branch) simply reads as "nothing loaded yet".
  const [tracksFor, setTracksFor] = useState<{ key: number; rows: Track[] } | null>(null);
  const [subjectsFor, setSubjectsFor] = useState<{ key: string; rows: StageSubject[] } | null>(null);

  const verticalId = Form.useWatch("vertical", form) ?? card?.stage.id;
  const trackId = Form.useWatch("track", form) ?? card?.track?.id;
  const stage = stages.find((s) => s.id === verticalId);
  const needsTrack = stage ? stage.child_kind !== "NONE" : Boolean(card?.track);
  const rule = rules.find((r) => r.vertical === verticalId);
  const minMinor = Math.max(1, rule?.min_price_minor ?? card?.min_price_minor ?? 0);
  const currency = rule?.currency ?? card?.price.currency ?? "";
  const subjectsKey = verticalId && (!needsTrack || trackId) ? cardKey(verticalId, needsTrack ? trackId! : null) : null;
  const tracks = tracksFor && tracksFor.key === verticalId ? tracksFor.rows : [];
  const subjects = useMemo(
    () => (subjectsFor && subjectsFor.key === subjectsKey ? subjectsFor.rows : []),
    [subjectsFor, subjectsKey],
  );

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

  const initialValues: FormValues = card
    ? {
        vertical: card.stage.id,
        track: card.track?.id,
        subjects: card.subjects.map((s) => s.id),
        price: card.price.amount_minor / 100,
        free_lessons_offered: card.free_lessons_offered,
        availability: toRows(card.availability),
      }
    : { subjects: [], free_lessons_offered: 0, availability: [{}] };

  // Keep previously chosen subjects selectable while the catalog loads.
  const subjectOptions = useMemo(() => {
    const opts = new Map<number, string>();
    for (const s of card?.subjects ?? []) opts.set(s.id, locale === "ar" ? s.name_ar : s.name_en);
    for (const ss of subjects) opts.set(ss.subject, locale === "ar" ? ss.subject_name_ar : ss.subject_name_en);
    return [...opts].map(([value, label]) => ({ value, label }));
  }, [subjects, card, locale]);

  async function submit(values: FormValues) {
    const vertical = values.vertical ?? card!.stage.id;
    const track = needsTrack ? (values.track ?? card?.track?.id ?? null) : null;
    const windows: WeeklyWindow[] = (values.availability ?? [])
      .filter((r) => r.weekday != null && r.range?.[0] && r.range?.[1])
      .map((r) => ({
        weekday: r.weekday!,
        start_time: r.range![0]!.format("HH:mm"),
        end_time: r.range![1]!.format("HH:mm"),
      }));
    const priceMinor = Math.round((values.price ?? 0) * 100);
    const input: StageCardInput = {
      vertical,
      track,
      subjects: values.subjects ?? [],
      price_minor: priceMinor,
      free_lessons_offered: values.free_lessons_offered ?? 0,
      availability: windows,
    };

    const stageRow = stages.find((s) => s.id === vertical);
    const trackRow = tracks.find((t) => t.id === track);
    const subjectNames = new Map(
      subjects.map((ss) => [ss.subject, { id: ss.subject, name_en: ss.subject_name_en, name_ar: ss.subject_name_ar }]),
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

  return (
    <Modal
      open
      width={640}
      title={card ? dict.editStageTitle : dict.newStageTitle}
      okText={dict.save}
      cancelText={dict.cancel}
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        onFinish={submit}
        onValuesChange={(changed) => {
          if ("vertical" in changed) form.setFieldsValue({ track: undefined, subjects: [] });
          if ("track" in changed) form.setFieldsValue({ subjects: [] });
        }}
      >
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="vertical"
            label={dict.stage}
            rules={[
              { required: true, message: dict.requiredStage },
              {
                validator: (_, value) =>
                  !card && value && !needsTrack && takenKeys.has(cardKey(value, null))
                    ? Promise.reject(new Error(dict.duplicateStage))
                    : Promise.resolve(),
              },
            ]}
          >
            <Select
              placeholder={dict.chooseStage}
              disabled={Boolean(card)}
              options={stages.map((s) => ({ value: s.id, label: catalogName(s, locale) }))}
            />
          </Form.Item>
          {needsTrack && (
            <Form.Item
              name="track"
              label={stage?.child_kind === "FACULTY" ? dict.faculty : dict.branch}
              rules={[
                { required: true, message: dict.requiredTrack },
                {
                  validator: (_, value) =>
                    !card && value && verticalId && takenKeys.has(cardKey(verticalId, value))
                      ? Promise.reject(new Error(dict.duplicateStage))
                      : Promise.resolve(),
                },
              ]}
            >
              <Select
                placeholder={stage?.child_kind === "FACULTY" ? dict.chooseFaculty : dict.chooseBranch}
                disabled={Boolean(card)}
                options={
                  card?.track && tracks.length === 0
                    ? [{ value: card.track.id, label: locale === "ar" ? card.track.name_ar : card.track.name_en }]
                    : tracks.map((t) => ({ value: t.id, label: catalogName(t, locale) }))
                }
              />
            </Form.Item>
          )}
        </div>

        <Form.Item
          name="subjects"
          label={dict.subjects}
          rules={[{ required: true, type: "array", min: 1, message: dict.requiredSubjects }]}
        >
          <Select
            mode="multiple"
            placeholder={dict.chooseSubjects}
            disabled={!verticalId || (needsTrack && !trackId)}
            optionFilterProp="label"
            options={subjectOptions}
          />
        </Form.Item>

        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item
            name="price"
            label={dict.price}
            extra={verticalId ? dict.minPrice.replace("{amount}", formatMoney(minMinor, currency)) : undefined}
            rules={[
              { required: true, message: dict.requiredPrice },
              {
                validator: (_, value) =>
                  value == null || Math.round(value * 100) >= minMinor
                    ? Promise.resolve()
                    : Promise.reject(
                        new Error(dict.priceTooLow.replace("{amount}", formatMoney(minMinor, currency))),
                      ),
              },
            ]}
          >
            <InputNumber min={0} step={0.5} addonAfter={currency || undefined} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="free_lessons_offered" label={dict.freeLessons} extra={dict.freeLessonsHint}>
            <InputNumber min={0} max={10} style={{ width: "100%" }} />
          </Form.Item>
        </div>

        <div className="mb-1 font-medium" style={{ color: "var(--ink)" }}>{dict.availability}</div>
        <Text type="secondary" className="mb-2 block text-sm">{dict.availabilityHint}</Text>
        <Form.List
          name="availability"
          rules={[
            {
              validator: async (_, rows: WindowRow[] | undefined) => {
                const filled = (rows ?? []).filter((r) => r?.weekday != null && r.range?.[0] && r.range?.[1]);
                if (filled.some((r) => !r.range![1]!.isAfter(r.range![0]!))) {
                  throw new Error(dict.endAfterStart);
                }
                const sorted = [...filled].sort(
                  (a, b) => a.weekday! - b.weekday! || a.range![0]!.diff(b.range![0]!),
                );
                for (let i = 1; i < sorted.length; i++) {
                  const prev = sorted[i - 1];
                  const cur = sorted[i];
                  if (prev.weekday === cur.weekday && cur.range![0]!.isBefore(prev.range![1]!)) {
                    throw new Error(dict.overlap);
                  }
                }
              },
            },
          ]}
        >
          {(fields, { add, remove }, { errors }) => (
            <div className="flex flex-col gap-2">
              {fields.map((field) => (
                <div key={field.key} className="flex flex-wrap items-start gap-2">
                  <Form.Item name={[field.name, "weekday"]} className="!mb-0" style={{ minWidth: 140 }}>
                    <Select
                      placeholder={dict.day}
                      options={dict.weekdays.map((d, i) => ({ value: i, label: d }))}
                    />
                  </Form.Item>
                  <Form.Item name={[field.name, "range"]} className="!mb-0">
                    <TimePicker.RangePicker
                      format="HH:mm"
                      minuteStep={15}
                      placeholder={[dict.from, dict.to]}
                      order={false}
                    />
                  </Form.Item>
                  <Button
                    danger
                    type="text"
                    icon={<Trash2 size={15} />}
                    onClick={() => remove(field.name)}
                    aria-label={dict.remove}
                  />
                </div>
              ))}
              <Form.ErrorList errors={errors} />
              <Button icon={<Plus size={15} />} onClick={() => add({})} className="self-start">
                {dict.addHours}
              </Button>
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
