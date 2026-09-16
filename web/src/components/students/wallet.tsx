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
  Radio,
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
  RECEIPT_IMAGE_ACCEPT,
  RECEIPT_IMAGE_MAX_BYTES,
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

/** Client-side check mirroring the API: an image (JPG/PNG/WebP/HEIC) up to 10 MB. */
function isReceiptImage(file: File): boolean {
  return RECEIPT_IMAGE_ACCEPT.split(",").includes(file.type) && file.size <= RECEIPT_IMAGE_MAX_BYTES;
}

/** Pick the account the student paid into (required on every receipt). */
function AccountChoices({
  accounts,
  dict,
  value,
  onChange,
}: {
  accounts: PaymentAccount[];
  dict: Dict;
  value?: number;
  onChange?: (id: number) => void;
}) {
  return (
    <Radio.Group value={value} onChange={(e) => onChange?.(e.target.value)} className="w-full">
      <div className="grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => (
          <Radio
            key={a.id}
            value={a.id}
            className="!m-0 rounded-xl p-3"
            style={{ border: `1px solid ${value === a.id ? "var(--brand)" : "var(--border)"}` }}
          >
            <span className="flex flex-col">
              <span className="font-medium" style={{ color: "var(--ink)" }}>
                {a.display_name}{" "}
                <Tag bordered={false} className="ms-1">
                  {a.kind === "BANK" ? dict.bank : dict.walletMethod}
                </Tag>
              </span>
              <span className="text-xs" dir="ltr" style={{ color: "var(--ink-muted)" }}>{a.details}</span>
            </span>
          </Radio>
        ))}
      </div>
    </Radio.Group>
  );
}

/** Single receipt image picker (form control) that rejects non-images up front. */
function ReceiptUpload({
  dict,
  value: file = null,
  onChange,
}: {
  dict: Dict;
  value?: File | null;
  onChange?: (file: File | null) => void;
}) {
  const { message } = App.useApp();
  return (
    <Upload
      accept={RECEIPT_IMAGE_ACCEPT}
      maxCount={1}
      listType="picture"
      fileList={file ? [{ uid: "receipt", name: file.name, status: "done", originFileObj: file as never }] : []}
      beforeUpload={(f) => {
        if (isReceiptImage(f)) onChange?.(f);
        else message.error(dict.invalidImage);
        return false;
      }}
      onRemove={() => onChange?.(null)}
    >
      <Button icon={<UploadCloud size={16} />}>{dict.upload}</Button>
    </Upload>
  );
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

  async function submitTopUp(values: {
    amount: number;
    payment_account: number;
    reference?: string;
    image: File;
  }) {
    if (!wallet) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount_minor", String(Math.round(values.amount * 100)));
      fd.append("payment_account", String(values.payment_account));
      fd.append("purpose", "TOPUP");
      if (values.reference) fd.append("reference", values.reference);
      fd.append("image", values.image);
      await createReceipt(fd);
      message.success(dict.submitted);
      form.resetFields();
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
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={submitTopUp}
          initialValues={{ payment_account: accounts.length === 1 ? accounts[0].id : undefined }}
        >
          <Form.Item
            name="payment_account"
            label={dict.payTo}
            rules={[{ required: true, message: dict.requiredAccount }]}
          >
            <AccountChoices accounts={accounts} dict={dict} />
          </Form.Item>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="amount"
              label={`${dict.amount} (${cur})`}
              rules={[{ required: true, message: dict.requiredAmount }]}
            >
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="reference" label={dict.reference}>
              <Input />
            </Form.Item>
          </div>
          <Form.Item
            name="image"
            label={dict.receiptImage}
            rules={[{ required: true, message: dict.requiredImage }]}
          >
            <ReceiptUpload dict={dict} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting} disabled={accounts.length === 0}>
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
          accounts={accounts}
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
  accounts,
  dict,
  onClose,
  onDone,
}: {
  pkg: Package;
  accounts: PaymentAccount[];
  dict: Dict;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const [accountId, setAccountId] = useState<number | undefined>(
    accounts.length === 1 ? accounts[0].id : undefined,
  );
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  async function submit() {
    setTouched(true);
    if (!accountId || !file) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("payment_account", String(accountId));
      if (reference) fd.append("reference", reference);
      fd.append("image", file);
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
    <Modal
      open
      width={600}
      onCancel={onClose}
      onOk={submit}
      title={`${dict.buy} · ${pkg.name}`}
      okText={dict.submit}
      okButtonProps={{ loading: submitting, disabled: accounts.length === 0 }}
    >
      <div className="flex flex-col gap-4 py-2">
        <div className="text-lg font-bold" style={{ color: "var(--ink)" }}>{pkg.price_display}</div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.payTo}</span>
          {accounts.length === 0 ? (
            <Text type="secondary">{dict.noAccounts}</Text>
          ) : (
            <AccountChoices accounts={accounts} dict={dict} value={accountId} onChange={setAccountId} />
          )}
          {touched && !accountId && <Text type="danger">{dict.requiredAccount}</Text>}
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.reference}</span>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: "var(--ink-muted)" }}>{dict.receiptImage}</span>
          <ReceiptUpload dict={dict} value={file} onChange={setFile} />
          {touched && !file && <Text type="danger">{dict.requiredImage}</Text>}
        </div>
      </div>
    </Modal>
  );
}
