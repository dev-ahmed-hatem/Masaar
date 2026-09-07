"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Form,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
} from "antd";
import type { ColumnsType } from "antd/es/table";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { MARKETS, marketLabel } from "@/lib/markets";
import { PageHeader } from "@/components/ui";
import {
  pricingApi,
  type GradeLevel,
  type LessonCategoryAdmin,
  type StagePricingRuleAdmin,
  type Subject,
  type Vertical,
} from "@/lib/pricing";

type Dict = Dictionary["adminPricing"];

export default function PricingView({ dict, locale }: { dict: Dict; locale: Locale }) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      <Tabs
        items={[
          {
            key: "stage-rules",
            label: dict.tabStageRules,
            children: <StageRulesTab dict={dict} locale={locale} />,
          },
          {
            key: "categories",
            label: dict.tabCategories,
            children: <CategoriesTab dict={dict} locale={locale} />,
          },
        ]}
      />
    </section>
  );
}

// --- Stage rules: minimum price + platform commission per (market, stage) ----

function StageRulesTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const [market, setMarket] = useState("EG");
  const [rows, setRows] = useState<StagePricingRuleAdmin[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    pricingApi
      .listStageRules(market)
      .then((res) => setRows(res.results))
      .catch(() => setRows([]));
  }, [market]);

  useEffect(load, [load]);

  async function patch(id: number, body: Parameters<typeof pricingApi.updateStageRule>[1]) {
    try {
      const updated = await pricingApi.updateStageRule(id, body);
      setRows((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? prev);
      message.success(dict.saved);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  async function remove(id: number) {
    try {
      await pricingApi.deleteStageRule(id);
      setRows((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      message.success(dict.saved);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  const columns: ColumnsType<StagePricingRuleAdmin> = [
    {
      title: dict.colStage,
      key: "stage",
      render: (_, r) => (ar ? r.stage_name_ar : r.stage_name_en),
    },
    {
      title: dict.colMinPrice,
      key: "min",
      width: 190,
      render: (_, r) => (
        <PriceCell
          minor={r.min_price_minor}
          suffix={r.currency}
          step={0.5}
          onSave={(v) => patch(r.id, { min_price_minor: v })}
        />
      ),
    },
    {
      title: dict.colCommission,
      key: "commission",
      width: 170,
      render: (_, r) => (
        <PriceCell
          minor={Math.round(parseFloat(r.commission_pct) * 100)}
          suffix="%"
          step={1}
          onSave={(v) => patch(r.id, { commission_pct: v / 100 })}
        />
      ),
    },
    {
      title: dict.colActive,
      key: "active",
      width: 90,
      render: (_, r) => (
        <Switch checked={r.is_active} onChange={(v) => patch(r.id, { is_active: v })} />
      ),
    },
    {
      title: "",
      key: "actions",
      width: 90,
      render: (_, r) => (
        <Popconfirm title={dict.deleteConfirm} onConfirm={() => remove(r.id)}>
          <Button danger size="small">
            {dict.delete}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const usedStageIds = new Set((rows ?? []).map((r) => r.vertical));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={market}
          onChange={setMarket}
          options={MARKETS.map((m) => ({ value: m.code, label: marketLabel(m.code, locale) }))}
          style={{ width: 120 }}
        />
        <Button type="primary" onClick={() => setCreating(true)}>
          {dict.newRule}
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows ?? []}
        loading={rows == null}
        pagination={false}
        size="middle"
        locale={{ emptyText: dict.noRules }}
      />
      <NewStageRuleModal
        dict={dict}
        locale={locale}
        market={market}
        usedStageIds={usedStageIds}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(rule) => {
          setCreating(false);
          setRows((prev) => (prev ? [...prev, rule] : [rule]));
        }}
      />
    </div>
  );
}

function NewStageRuleModal({
  dict,
  locale,
  market,
  usedStageIds,
  open,
  onClose,
  onCreated,
}: {
  dict: Dict;
  locale: Locale;
  market: string;
  usedStageIds: Set<number>;
  open: boolean;
  onClose: () => void;
  onCreated: (rule: StagePricingRuleAdmin) => void;
}) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const [form] = Form.useForm();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) pricingApi.listVerticals().then(setVerticals).catch(() => undefined);
  }, [open]);

  async function onFinish(values: { vertical: number; min_price: number; commission_pct: number }) {
    setSaving(true);
    try {
      const created = await pricingApi.createStageRule({
        market,
        vertical: values.vertical,
        min_price_minor: Math.round(values.min_price * 100),
        commission_pct: values.commission_pct,
      });
      form.resetFields();
      message.success(dict.saved);
      onCreated(created);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  const options = verticals
    .filter((v) => !usedStageIds.has(v.id))
    .map((v) => ({ value: v.id, label: ar ? v.name_ar : v.name_en }));

  return (
    <Modal open={open} onCancel={onClose} title={`${dict.newRule} · ${market}`} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="vertical" label={dict.colStage} rules={[{ required: true }]}>
          <Select options={options} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="min_price" label={dict.colMinPrice} rules={[{ required: true }]}>
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} addonAfter={market === "SA" ? "SAR" : "EGP"} />
          </Form.Item>
          <Form.Item name="commission_pct" label={dict.colCommission} rules={[{ required: true }]}>
            <InputNumber min={0} max={100} step={1} style={{ width: "100%" }} addonAfter="%" />
          </Form.Item>
        </div>
        <Button type="primary" htmlType="submit" block loading={saving}>
          {dict.create}
        </Button>
      </Form>
    </Modal>
  );
}

// --- Lesson categories: taxonomy only (which subjects are bookable) ----------

function CategoriesTab({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const [market, setMarket] = useState("EG");
  const [rows, setRows] = useState<LessonCategoryAdmin[] | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    pricingApi
      .listCategories(market)
      .then((res) => setRows(res.results))
      .catch(() => setRows([]));
  }, [market]);

  useEffect(load, [load]);

  async function patch(id: number, patchBody: Parameters<typeof pricingApi.updateCategory>[1]) {
    try {
      const updated = await pricingApi.updateCategory(id, patchBody);
      setRows((prev) => prev?.map((r) => (r.id === id ? updated : r)) ?? prev);
      message.success(dict.saved);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  const columns: ColumnsType<LessonCategoryAdmin> = [
    {
      title: dict.colCategory,
      key: "label",
      render: (_, r) => (ar ? r.label_ar : r.label),
    },
    {
      title: dict.colActive,
      key: "active",
      width: 90,
      render: (_, r) => (
        <Switch checked={r.is_active} onChange={(v) => patch(r.id, { is_active: v })} />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={market}
          onChange={setMarket}
          options={MARKETS.map((m) => ({ value: m.code, label: marketLabel(m.code, locale) }))}
          style={{ width: 120 }}
        />
        <Button type="primary" onClick={() => setCreating(true)}>
          {dict.newCategory}
        </Button>
      </div>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows ?? []}
        loading={rows == null}
        pagination={false}
        size="middle"
      />
      <NewCategoryModal
        dict={dict}
        locale={locale}
        market={market}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(cat) => {
          setCreating(false);
          setRows((prev) => (prev ? [...prev, cat] : [cat]));
        }}
      />
    </div>
  );
}

function PriceCell({
  minor,
  suffix,
  step,
  onSave,
}: {
  minor: number;
  suffix: string;
  step: number;
  onSave: (minor: number) => Promise<void>;
}) {
  const [value, setValue] = useState(minor / 100);
  const [loading, setLoading] = useState(false);
  const dirty = Math.round(value * 100) !== minor;

  useEffect(() => setValue(minor / 100), [minor]);

  async function save() {
    setLoading(true);
    try {
      await onSave(Math.round(value * 100));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Space.Compact>
      <InputNumber
        min={0}
        step={step}
        value={value}
        onChange={(v) => setValue(v ?? 0)}
        addonAfter={suffix}
        style={{ width: 140 }}
      />
      {dirty && (
        <Button type="primary" loading={loading} onClick={save}>
          ✓
        </Button>
      )}
    </Space.Compact>
  );
}

function NewCategoryModal({
  dict,
  locale,
  market,
  open,
  onClose,
  onCreated,
}: {
  dict: Dict;
  locale: Locale;
  market: string;
  open: boolean;
  onClose: () => void;
  onCreated: (cat: LessonCategoryAdmin) => void;
}) {
  const { message } = App.useApp();
  const ar = locale === "ar";
  const [form] = Form.useForm();
  const [verticals, setVerticals] = useState<Vertical[]>([]);
  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);
  const vertical = Form.useWatch("vertical", form);

  useEffect(() => {
    if (!open) return;
    pricingApi.listVerticals().then(setVerticals).catch(() => undefined);
    pricingApi.listSubjects().then(setSubjects).catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!vertical) {
      setGrades([]);
      return;
    }
    pricingApi.listGrades(vertical).then(setGrades).catch(() => setGrades([]));
  }, [vertical]);

  async function onFinish(values: { vertical: number; grade_level?: number; subject: number }) {
    setSaving(true);
    try {
      const created = await pricingApi.createCategory({
        market,
        vertical: values.vertical,
        grade_level: values.grade_level ?? null,
        subject: values.subject,
      });
      form.resetFields();
      message.success(dict.saved);
      onCreated(created);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  const name = (o: { name_en: string; name_ar: string }) => (ar ? o.name_ar : o.name_en);

  return (
    <Modal open={open} onCancel={onClose} title={`${dict.newCategory} · ${market}`} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="vertical" label={dict.vertical} rules={[{ required: true }]}>
          <Select options={verticals.map((v) => ({ value: v.id, label: name(v) }))} />
        </Form.Item>
        <Form.Item name="grade_level" label={dict.grade}>
          <Select
            allowClear
            disabled={!vertical}
            options={grades.map((g) => ({ value: g.id, label: name(g) }))}
          />
        </Form.Item>
        <Form.Item name="subject" label={dict.subject} rules={[{ required: true }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={subjects.map((s) => ({ value: s.id, label: name(s) }))}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={saving}>
          {dict.create}
        </Button>
      </Form>
    </Modal>
  );
}
