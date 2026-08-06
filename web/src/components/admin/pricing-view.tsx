"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Badge,
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
  Tag,
  Input,
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
  type PriceRequestAdmin,
  type Subject,
  type Vertical,
} from "@/lib/pricing";

type Dict = Dictionary["adminPricing"];

function money(minor: number, currency: string): string {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

export default function PricingView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />

      <Tabs
        items={[
          {
            key: "categories",
            label: dict.tabCategories,
            children: <CategoriesTab dict={dict} locale={locale} />,
          },
          {
            key: "requests",
            label: (
              <span>
                {dict.tabRequests}
                {pendingCount > 0 && <Badge count={pendingCount} size="small" className="ms-2" />}
              </span>
            ),
            children: (
              <RequestsTab dict={dict} locale={locale} onPendingCount={setPendingCount} />
            ),
          },
        ]}
      />
    </section>
  );
}

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
      title: dict.colStudentPrice,
      key: "price",
      width: 180,
      render: (_, r) => (
        <PriceCell
          minor={r.student_price_minor}
          currency={r.currency}
          onSave={(minor) => patch(r.id, { student_price_minor: minor })}
        />
      ),
    },
    {
      title: dict.colTeacherWage,
      key: "wage",
      width: 180,
      render: (_, r) => (
        <PriceCell
          minor={r.teacher_wage_minor}
          currency={r.currency}
          onSave={(minor) => patch(r.id, { teacher_wage_minor: minor })}
        />
      ),
    },
    {
      title: dict.colMargin,
      key: "margin",
      width: 120,
      render: (_, r) => money(r.student_price_minor - r.teacher_wage_minor, r.currency),
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
  currency,
  onSave,
}: {
  minor: number;
  currency: string;
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
        step={0.5}
        value={value}
        onChange={(v) => setValue(v ?? 0)}
        addonAfter={currency}
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

  async function onFinish(values: {
    vertical: number;
    grade_level?: number;
    subject: number;
    student_price: number;
    teacher_wage: number;
  }) {
    setSaving(true);
    try {
      const created = await pricingApi.createCategory({
        market,
        vertical: values.vertical,
        grade_level: values.grade_level ?? null,
        subject: values.subject,
        student_price_minor: Math.round(values.student_price * 100),
        teacher_wage_minor: Math.round(values.teacher_wage * 100),
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
    <Modal
      open={open}
      onCancel={onClose}
      title={`${dict.newCategory} · ${market}`}
      footer={null}
      destroyOnHidden
    >
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
        <div className="grid grid-cols-2 gap-x-4">
          <Form.Item name="student_price" label={dict.colStudentPrice} rules={[{ required: true }]}>
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="teacher_wage" label={dict.colTeacherWage} rules={[{ required: true }]}>
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
        </div>
        <Button type="primary" htmlType="submit" block loading={saving}>
          {dict.create}
        </Button>
      </Form>
    </Modal>
  );
}

function RequestsTab({
  dict,
  onPendingCount,
}: {
  dict: Dict;
  locale: Locale;
  onPendingCount: (n: number) => void;
}) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<"pending" | "approved">("pending");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<PriceRequestAdmin[] | null>(null);
  const [rejecting, setRejecting] = useState<PriceRequestAdmin | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setRows(null);
    pricingApi
      .listPriceRequests(status, page, 20)
      .then((res) => {
        setRows(res.results);
        setTotal(res.count);
        if (status === "pending") onPendingCount(res.count);
      })
      .catch(() => setRows([]));
  }, [status, page, onPendingCount]);

  useEffect(load, [load]);

  useEffect(() => setPage(1), [status]);

  async function approve(row: PriceRequestAdmin) {
    try {
      await pricingApi.approvePriceRequest(row.id);
      message.success(dict.approved);
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  async function reject() {
    if (!rejecting) return;
    try {
      await pricingApi.rejectPriceRequest(rejecting.id, reason);
      message.success(dict.rejected);
      setRejecting(null);
      setReason("");
      load();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  const columns: ColumnsType<PriceRequestAdmin> = [
    { title: dict.colTeacher, dataIndex: "teacher_name", key: "teacher" },
    { title: dict.colCategory, dataIndex: "label", key: "label" },
    { title: dict.colMarket, dataIndex: "market", key: "market", width: 90 },
    {
      title: dict.colDefaultPrice,
      key: "default",
      render: (_, r) => money(r.default_price_minor, r.currency),
    },
    {
      title: dict.colRequestedPrice,
      key: "requested",
      render: (_, r) => {
        const up = r.custom_student_price_minor > r.default_price_minor;
        return (
          <Tag color={up ? "volcano" : "green"}>{money(r.custom_student_price_minor, r.currency)}</Tag>
        );
      },
    },
    {
      title: "",
      key: "actions",
      width: 200,
      render: (_, r) =>
        status === "pending" ? (
          <Space>
            <Popconfirm title={dict.approveConfirm} onConfirm={() => approve(r)}>
              <Button type="primary" size="small">
                {dict.approve}
              </Button>
            </Popconfirm>
            <Button danger size="small" onClick={() => setRejecting(r)}>
              {dict.reject}
            </Button>
          </Space>
        ) : (
          <Tag color="green">{dict.statusApproved}</Tag>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Select
        value={status}
        onChange={setStatus}
        style={{ width: 180 }}
        options={[
          { value: "pending", label: dict.statusPending },
          { value: "approved", label: dict.statusApproved },
        ]}
      />
      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows ?? []}
        loading={rows == null}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          onChange: setPage,
        }}
        size="middle"
        locale={{ emptyText: dict.noRequests }}
      />
      <Modal
        open={rejecting != null}
        onCancel={() => setRejecting(null)}
        onOk={reject}
        okButtonProps={{ danger: true }}
        okText={dict.reject}
        title={dict.rejectTitle}
      >
        <Input.TextArea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={dict.rejectReason}
        />
      </Modal>
    </div>
  );
}
