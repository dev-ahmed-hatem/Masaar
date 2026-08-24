"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Tag,
  Typography,
  Upload,
} from "antd";
import { UploadCloud } from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import {
  createReceipt,
  getWallet,
  listPackages,
  listPaymentAccounts,
  listReceipts,
  purchasePackage,
  type LedgerEntry,
  type Package,
  type PaymentAccount,
  type Receipt,
  type ReceiptStatus,
  type Wallet,
} from "@/lib/wallet";
import { ListRow } from "@/components/ui";

type Dict = Dictionary["wallet"];

const { Paragraph, Text } = Typography;

const STATUS_COLOR: Record<ReceiptStatus, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
};

function toArray<T>(res: { results: T[] } | T[]): T[] {
  return Array.isArray(res) ? res : res.results;
}

export default function WalletView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const { message } = App.useApp();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [, setLedger] = useState<LedgerEntry[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<Package | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [topUpFile, setTopUpFile] = useState<File | null>(null);
  const [form] = Form.useForm();

  const statusLabel = useCallback(
    (s: ReceiptStatus) => dict[`status${s}` as keyof Dict] as string,
    [dict],
  );

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getWallet(), listPaymentAccounts(), listPackages(), listReceipts()])
      .then(([w, acc, pkgs, rcpts]) => {
        setWallet(w.wallet);
        setLedger(w.ledger);
        setAccounts(acc);
        setPackages(pkgs);
        setReceipts(toArray(rcpts));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => reload(), [reload]);

  async function submitTopUp(values: { amount: number; method: string; reference?: string }) {
    if (!wallet) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount_minor", String(Math.round(values.amount * 100)));
      fd.append("method", values.method);
      fd.append("purpose", "TOPUP");
      if (values.reference) fd.append("reference", values.reference);
      if (topUpFile) fd.append("image", topUpFile);
      await createReceipt(fd);
      message.success(dict.submitted);
      form.resetFields();
      setTopUpFile(null);
      reload();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spin />
      </div>
    );
  }
  if (error || !wallet) {
    return <Alert type="error" showIcon message={error ?? dict.loadError} />;
  }

  const cur = wallet.currency;
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${cur}`;

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {dict.title}
      </h1>

      {/* Balance header */}
      <div className="surface flex flex-wrap items-end justify-between gap-4 p-5 sm:p-6" style={{ background: "var(--grad-brand-soft)" }}>
        <div>
          <div className="text-sm" style={{ color: "var(--ink-muted)" }}>{dict.available}</div>
          <div className="text-3xl font-bold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            {wallet.available_display}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--ink-faint)" }}>
            {dict.reserved}: {money(wallet.reserved_minor)}
          </div>
        </div>
        <a href="#topup" className="btn btn-primary">{dict.topUp}</a>
      </div>

      <Alert type="info" showIcon message={dict.reviewNote} />

      {/* How to top up */}
      <div>
        <h2 className="mb-2 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.howToTitle}
        </h2>
        <Paragraph type="secondary">{dict.howToIntro}</Paragraph>
        {accounts.length === 0 ? (
          <Text type="secondary">{dict.noAccounts}</Text>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((a) => (
              <div key={a.id} className="surface p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: "var(--ink)" }}>{a.display_name}</span>
                  <Tag bordered={false}>{a.kind === "BANK" ? dict.bank : dict.walletMethod}</Tag>
                </div>
                <div className="mt-1 text-sm" style={{ color: "var(--ink)" }} dir="ltr">{a.details}</div>
                {a.instructions && (
                  <div className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>{a.instructions}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-up form */}
      <div id="topup" className="surface p-6">
        <h2 className="mb-4 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.topUpTitle}
        </h2>
        <Form form={form} layout="vertical" requiredMark={false} onFinish={submitTopUp} initialValues={{ method: "BANK" }}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item name="amount" label={`${dict.amount} (${cur})`} rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="method" label={dict.method} rules={[{ required: true }]}>
              <Select
                options={[
                  { value: "BANK", label: dict.bank },
                  { value: "WALLET", label: dict.walletMethod },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item name="reference" label={dict.reference}>
            <Input />
          </Form.Item>
          <Form.Item label={dict.receiptImage}>
            <Upload
              maxCount={1}
              beforeUpload={(f) => {
                setTopUpFile(f);
                return false;
              }}
              onRemove={() => setTopUpFile(null)}
            >
              <Button icon={<UploadCloud size={16} />}>{dict.upload}</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            {dict.submit}
          </Button>
        </Form>
      </div>

      {/* Recent receipts */}
      <div>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.recentTitle}
        </h2>
        {receipts.length === 0 ? (
          <Empty description={dict.noReceipts} />
        ) : (
          <div className="flex flex-col gap-2">
            {receipts.map((r) => (
              <ListRow
                key={r.id}
                title={r.amount_display}
                subtitle={new Date(r.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
                trailing={
                  <Tag color={STATUS_COLOR[r.status]} bordered={false} style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {statusLabel(r.status)}
                  </Tag>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Packages */}
      <div>
        <h2 className="mb-1 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          {dict.packagesTitle}
        </h2>
        <Paragraph type="secondary">{dict.packagesIntro}</Paragraph>
        {packages.length === 0 ? (
          <Text type="secondary">{dict.noPackages}</Text>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {packages.map((p) => (
              <div key={p.id} className="surface flex flex-col gap-2 p-5">
                <span className="font-semibold" style={{ color: "var(--ink)" }}>{p.name}</span>
                <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {dict.credits.replace("{n}", String(p.credits))}
                </span>
                <span className="text-lg font-bold" style={{ color: "var(--ink)" }}>{p.price_display}</span>
                <Button type="primary" className="mt-2" onClick={() => setBuying(p)}>
                  {dict.buy}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {buying && (
        <PurchaseModal
          pkg={buying}
          dict={dict}
          onClose={() => setBuying(null)}
          onDone={() => {
            setBuying(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function PurchaseModal({
  pkg,
  dict,
  onClose,
  onDone,
}: {
  pkg: Package;
  dict: Dict;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [method, setMethod] = useState("BANK");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("method", method);
      if (reference) fd.append("reference", reference);
      if (file) fd.append("image", file);
      await purchasePackage(pkg.id, fd);
      message.success(dict.purchased);
      onDone();
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onCancel={onClose} onOk={submit} title={`${dict.buy} · ${pkg.name}`} okText={dict.submit} okButtonProps={{ loading: submitting }}>
      <div className="flex flex-col gap-4 py-2">
        <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{pkg.price_display}</div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.method}</span>
          <Select
            value={method}
            onChange={setMethod}
            options={[
              { value: "BANK", label: dict.bank },
              { value: "WALLET", label: dict.walletMethod },
            ]}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.reference}</span>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <Upload
          maxCount={1}
          beforeUpload={(f) => {
            setFile(f);
            return false;
          }}
          onRemove={() => setFile(null)}
        >
          <Button icon={<UploadCloud size={16} />}>{dict.upload}</Button>
        </Upload>
      </div>
    </Modal>
  );
}
