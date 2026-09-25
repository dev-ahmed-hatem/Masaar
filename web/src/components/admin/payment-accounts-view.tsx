"use client";

import { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Plus } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import CountrySelect from "@/components/admin/country-select";
import {
  paymentAccountsApi,
  type PaymentAccountAdmin,
  type PaymentAccountInput,
} from "@/lib/payment-accounts";
import { PageHeader, Panel } from "@/components/ui";
import { Badge } from "@/components/ui/badge";

type Dict = Dictionary["adminPaymentAccounts"];

/** Moderator management of the accounts students pay into, per market. */
export default function PaymentAccountsView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [market, setMarket] = useState("EG");
  const [rows, setRows] = useState<PaymentAccountAdmin[] | null>(null);
  const [editing, setEditing] = useState<PaymentAccountAdmin | "new" | null>(null);

  const fail = useCallback(
    (err: unknown) => message.error(err instanceof ApiError ? err.message : dict.actionError),
    [message, dict.actionError],
  );

  const load = useCallback(() => {
    paymentAccountsApi
      .list(market)
      .then(setRows)
      .catch(() => {
        setRows([]);
        message.error(dict.loadError);
      });
  }, [market, message, dict.loadError]);

  useEffect(load, [load]);

  async function patch(row: PaymentAccountAdmin, body: Partial<PaymentAccountInput>) {
    try {
      const updated = await paymentAccountsApi.update(row.id, body);
      setRows((prev) => prev?.map((r) => (r.id === row.id ? updated : r)) ?? prev);
      message.success(dict.saved);
    } catch (err) {
      fail(err);
    }
  }

  async function remove(row: PaymentAccountAdmin) {
    try {
      await paymentAccountsApi.remove(row.id);
      setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? prev);
      message.success(dict.deleted);
    } catch (err) {
      if (err instanceof ApiError && err.code === "in_use") message.error(dict.inUse);
      else fail(err);
    }
  }

  const columns: ColumnsType<PaymentAccountAdmin> = [
    {
      title: dict.colName,
      key: "name",
      render: (_, r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.display_name}</span>
          {r.instructions && (
            <span className="t-caption text-ink-muted">{r.instructions}</span>
          )}
        </div>
      ),
    },
    {
      title: dict.colKind,
      key: "kind",
      width: 150,
      render: (_, r) => (
        <Badge variant={r.kind === "BANK" ? "brand" : "neutral"} size="sm">
          {r.kind === "BANK" ? dict.kindBANK : dict.kindWALLET}
        </Badge>
      ),
    },
    {
      title: dict.colDetails,
      key: "details",
      render: (_, r) => (
        <span dir="ltr" style={{ whiteSpace: "pre-wrap" }}>{r.details}</span>
      ),
    },
    { title: dict.colOrder, dataIndex: "sort_order", key: "order", width: 80 },
    {
      title: dict.colActive,
      key: "active",
      width: 90,
      render: (_, r) => <Switch checked={r.is_active} onChange={(v) => patch(r, { is_active: v })} />,
    },
    {
      title: "",
      key: "actions",
      width: 160,
      render: (_, r) => (
        <div className="flex gap-2">
          <Button size="small" onClick={() => setEditing(r)}>
            {dict.edit}
          </Button>
          <Popconfirm title={dict.deleteConfirm} onConfirm={() => remove(r)}>
            <Button size="small" danger>
              {dict.delete}
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const toolbar = (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <CountrySelect
        locale={locale}
        value={market}
        onChange={(v) => {
          setRows(null);
          setMarket(v);
        }}
        style={{ width: 240 }}
        aria-label={dict.market}
      />
      <Button type="primary" icon={<Plus size={15} />} onClick={() => setEditing("new")}>
        {dict.add}
      </Button>
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={dict.title} subtitle={dict.intro} />
      <Panel toolbar={toolbar}>
        <Table<PaymentAccountAdmin>
          rowKey="id"
          columns={columns}
          dataSource={rows ?? []}
          loading={rows == null}
          pagination={false}
          scroll={{ x: 720 }}
          locale={{ emptyText: dict.empty }}
        />
      </Panel>

      {editing && (
        <AccountModal
          dict={dict}
          locale={locale}
          market={market}
          account={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null);
            message.success(dict.saved);
            // It may have moved to another market; reload the current list.
            if (saved.market !== market) load();
            else
              setRows((prev) => {
                const list = prev ?? [];
                return list.some((r) => r.id === saved.id)
                  ? list.map((r) => (r.id === saved.id ? saved : r))
                  : [...list, saved];
              });
          }}
          onError={fail}
        />
      )}
    </section>
  );
}

function AccountModal({
  dict,
  locale,
  market,
  account,
  onClose,
  onSaved,
  onError,
}: {
  dict: Dict;
  locale: Locale;
  market: string;
  account: PaymentAccountAdmin | null;
  onClose: () => void;
  onSaved: (account: PaymentAccountAdmin) => void;
  onError: (err: unknown) => void;
}) {
  const [form] = Form.useForm<PaymentAccountInput>();
  const [saving, setSaving] = useState(false);

  const initialValues: PaymentAccountInput = account
    ? {
        market: account.market,
        kind: account.kind,
        display_name: account.display_name,
        details: account.details,
        instructions: account.instructions,
        sort_order: account.sort_order,
        is_active: account.is_active,
      }
    : { market, kind: "BANK", display_name: "", details: "", instructions: "", sort_order: 0, is_active: true };

  async function submit(values: PaymentAccountInput) {
    setSaving(true);
    try {
      const saved = account
        ? await paymentAccountsApi.update(account.id, values)
        : await paymentAccountsApi.create(values);
      onSaved(saved);
    } catch (err) {
      onError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={account ? dict.editTitle : dict.newTitle}
      okText={dict.save}
      cancelText={dict.cancel}
      confirmLoading={saving}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Form<PaymentAccountInput>
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={initialValues}
        onFinish={submit}
      >
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
            <CountrySelect locale={locale} />
          </Form.Item>
          <Form.Item name="kind" label={dict.colKind} rules={[{ required: true }]}>
            <Select
              options={[
                { value: "BANK", label: dict.kindBANK },
                { value: "WALLET", label: dict.kindWALLET },
              ]}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="display_name"
          label={dict.displayName}
          extra={dict.displayNameHint}
          rules={[{ required: true, whitespace: true, message: dict.requiredName }]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item
          name="details"
          label={dict.details}
          extra={dict.detailsHint}
          rules={[{ required: true, whitespace: true, message: dict.requiredDetails }]}
        >
          <Input.TextArea rows={3} dir="ltr" />
        </Form.Item>
        <Form.Item name="instructions" label={dict.instructions} extra={dict.instructionsHint}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Form.Item name="sort_order" label={dict.sortOrder}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="is_active" label={dict.active} valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
