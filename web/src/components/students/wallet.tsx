"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Landmark,
  Receipt as ReceiptIcon,
  Smartphone,
  Wallet as WalletIcon,
} from "lucide-react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  createReceipt,
  getWallet,
  listPackages,
  listPaymentAccounts,
  listReceipts,
  purchasePackage,
  RECEIPT_IMAGE_ACCEPT,
  RECEIPT_IMAGE_MAX_BYTES,
  type Package,
  type PaymentAccount,
  type Receipt,
  type Wallet,
} from "@/lib/wallet";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { FileDrop } from "@/components/ui/file-drop";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Dict = Dictionary["wallet"];

const STATUS_TONE = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "error",
} as const;

function toArray<T>(res: { results: T[] } | T[]): T[] {
  return Array.isArray(res) ? res : res.results;
}

/** Copy one value and say so — the account numbers are long and mistyped easily. */
function CopyButton({ value, dict }: { value: string; dict: Dict }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(dict.copied);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value is on screen anyway */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${dict.copy}: ${value}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-control px-2 py-1 t-caption font-semibold text-brand transition-colors hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? dict.copied : dict.copy}
    </button>
  );
}

/**
 * One payable account, as a radio card. Selecting it is also step 1 of the
 * top-up form, so the student never picks the account twice.
 */
function AccountCard({
  account,
  dict,
  selected,
  onSelect,
  name,
}: {
  account: PaymentAccount;
  dict: Dict;
  selected: boolean;
  onSelect: () => void;
  name: string;
}) {
  const Icon = account.kind === "BANK" ? Landmark : Smartphone;
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-card border p-4 transition-colors",
        selected ? "border-brand bg-brand-tint/40" : "border-border bg-surface hover:border-brand/50",
      )}
    >
      <div className="flex items-start gap-3">
        <input
          type="radio"
          name={name}
          checked={selected}
          onChange={onSelect}
          className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span dir="auto" className="font-semibold text-ink">{account.display_name}</span>
            <Badge size="sm">
              <Icon aria-hidden />
              {account.kind === "BANK" ? dict.bank : dict.walletMethod}
            </Badge>
          </span>
          <span className="flex items-center gap-1">
            <span dir="ltr" className="min-w-0 flex-1 break-all font-mono t-small text-ink">
              {account.details}
            </span>
            <CopyButton value={account.details} dict={dict} />
          </span>
          {account.instructions ? (
            <span dir="auto" className="t-caption text-ink-muted">{account.instructions}</span>
          ) : null}
        </span>
      </div>
    </label>
  );
}

/** Numbered step in the top-up sequence. */
function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="group flex gap-3 sm:gap-4">
      <div className="flex flex-col items-center gap-1">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-display text-sm font-bold text-on-brand">
          {n}
        </span>
        {/* The rail ties the steps into one sequence; it has nothing to reach
            after the last one. */}
        <span className="w-px flex-1 bg-border group-last:hidden" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 pb-7 group-last:pb-0">
        <div>
          <h3 className="t-h4 text-ink">{title}</h3>
          {hint ? <p className="mt-0.5 t-small text-ink-muted">{hint}</p> : null}
        </div>
        {children}
      </div>
    </li>
  );
}

export default function WalletView({ dict, locale }: { dict: Dict; locale: Locale }) {
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<Package | null>(null);

  // Top-up form
  const [accountId, setAccountId] = useState<number | undefined>();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getWallet(), listPaymentAccounts(), listPackages(), listReceipts()])
      .then(([w, acc, pkgs, rcpts]) => {
        setWallet(w.wallet);
        setAccounts(acc);
        setPackages(pkgs);
        setReceipts(toArray(rcpts));
        // One account means there is nothing to choose — preselect it.
        if (acc.length === 1) setAccountId(acc[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : dict.loadError))
      .finally(() => setLoading(false));
  }, [dict.loadError]);

  useEffect(() => reload(), [reload]);

  const amountValue = Number(amount);
  const amountValid = amount !== "" && Number.isFinite(amountValue) && amountValue > 0;

  async function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!accountId || !amountValid || !file) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("amount_minor", String(Math.round(amountValue * 100)));
      fd.append("payment_account", String(accountId));
      fd.append("purpose", "TOPUP");
      if (reference) fd.append("reference", reference);
      fd.append("image", file);
      await createReceipt(fd);
      toast.success(dict.submitted);
      setAmount("");
      setReference("");
      setFile(null);
      setTouched(false);
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  if (error || !wallet) {
    return <Alert variant="error" title={error ?? dict.loadError} />;
  }

  const cur = wallet.currency;
  const money = (minor: number) => `${(minor / 100).toFixed(2)} ${cur}`;
  const noAccounts = accounts.length === 0;

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="t-h1 text-ink">{dict.title}</h1>
        <p className="max-w-2xl t-body text-ink-muted">{dict.intro}</p>
      </header>

      {/* Balance — the one inverted slab on this page. */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-panel bg-band p-6 text-on-band">
        <div className="flex flex-col gap-1">
          <span className="t-small text-on-band/80">{dict.available}</span>
          <span className="font-display text-4xl font-bold leading-none">
            {wallet.available_display}
          </span>
          <span className="t-caption text-on-band/80">
            {dict.reserved}: {money(wallet.reserved_minor)}
          </span>
        </div>
        <Button variant="accent" asChild>
          <a href="#topup">
            <WalletIcon aria-hidden />
            {dict.topUp}
          </a>
        </Button>
      </div>

      {/* Top-up: three steps, one form */}
      <Card id="topup" className="p-5 sm:p-6">
        <h2 className="mb-5 t-h3 text-ink">{dict.howToTitle}</h2>

        {noAccounts ? (
          <Alert variant="warning" title={dict.noAccounts} />
        ) : (
          <form onSubmit={submitTopUp} noValidate>
            <ol className="flex flex-col">
              <Step n={1} title={dict.stepChooseAccount} hint={dict.howToIntro}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {accounts.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      dict={dict}
                      name="topup-account"
                      selected={accountId === a.id}
                      onSelect={() => setAccountId(a.id)}
                    />
                  ))}
                </div>
                {touched && !accountId ? (
                  <p role="alert" className="t-caption text-error">{dict.requiredAccount}</p>
                ) : null}
              </Step>

              <Step n={2} title={dict.stepTransfer} hint={dict.stepTransferHint}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="topup-amount" required>
                      {`${dict.amount} (${cur})`}
                    </Label>
                    <Input
                      id="topup-amount"
                      inputMode="decimal"
                      dir="ltr"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      aria-invalid={touched && !amountValid ? true : undefined}
                      aria-describedby={touched && !amountValid ? "topup-amount-error" : undefined}
                    />
                    {touched && !amountValid ? (
                      <p id="topup-amount-error" role="alert" className="t-caption text-error">
                        {dict.requiredAmount}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="topup-reference">{dict.reference}</Label>
                    <Input
                      id="topup-reference"
                      dir="ltr"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                    />
                  </div>
                </div>
              </Step>

              <Step n={3} title={dict.stepUpload} hint={dict.stepUploadHint}>
                <FileDrop
                  value={file}
                  onChange={setFile}
                  accept={RECEIPT_IMAGE_ACCEPT}
                  maxBytes={RECEIPT_IMAGE_MAX_BYTES}
                  label={dict.upload}
                  hint={dict.imageHint}
                  invalidMessage={dict.invalidImage}
                  removeLabel={dict.removeImage}
                  invalid={touched && !file}
                />
                {touched && !file ? (
                  <p role="alert" className="t-caption text-error">{dict.requiredImage}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" loading={submitting}>
                    {dict.submit}
                  </Button>
                  <span className="t-caption text-ink-muted">{dict.reviewNote}</span>
                </div>
              </Step>
            </ol>
          </form>
        )}
      </Card>

      {/* Receipts, each with where it is in the review */}
      <section className="flex flex-col gap-3">
        <h2 className="t-h3 text-ink">{dict.recentTitle}</h2>
        {receipts.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ReceiptIcon aria-hidden />}
              title={dict.noReceipts}
              description={dict.noReceiptsHint}
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-3">
            {receipts.map((r) => (
              <li key={r.id}>
                <ReceiptCard receipt={r} dict={dict} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Packages */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="t-h3 text-ink">{dict.packagesTitle}</h2>
          <p className="mt-1 t-body text-ink-muted">{dict.packagesIntro}</p>
        </div>
        {packages.length === 0 ? (
          <p className="t-small text-ink-muted">{dict.noPackages}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((p) => (
              <Card key={p.id} className="flex flex-col gap-1 p-5">
                <span dir="auto" className="t-h4 text-ink">{p.name}</span>
                <span className="t-small text-ink-muted">
                  {dict.credits.replace("{n}", String(p.credits))}
                </span>
                <span className="mt-1 font-display text-2xl font-bold text-ink">
                  {p.price_display}
                </span>
                <Button
                  variant="outline"
                  className="mt-3"
                  disabled={noAccounts}
                  onClick={() => setBuying(p)}
                >
                  {dict.buy}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {buying ? (
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
      ) : null}
    </section>
  );
}

/**
 * A submitted receipt and where it stands. The three dots replace a bare
 * status tag: "pending" means nothing unless you can see what comes next.
 */
function ReceiptCard({
  receipt: r,
  dict,
  locale,
}: {
  receipt: Receipt;
  dict: Dict;
  locale: Locale;
}) {
  const statusLabel = dict[`status${r.status}` as keyof Dict] as string;
  const done = r.status !== "PENDING";
  const rejected = r.status === "REJECTED";

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-display text-lg font-bold text-ink">{r.amount_display}</span>
          <p className="t-caption text-ink-muted">
            {new Date(r.created_at).toLocaleDateString(locale, { dateStyle: "medium" })}
            {r.payment_account ? ` · ${r.payment_account.display_name}` : ""}
          </p>
        </div>
        <Badge variant={STATUS_TONE[r.status]} size="sm">{statusLabel}</Badge>
      </div>

      <ol className="flex items-center gap-1.5" aria-label={statusLabel}>
        <Dot state="done" />
        <Rail state="done" />
        <Dot state={done ? "done" : "current"} />
        <Rail state={done ? (rejected ? "error" : "done") : "todo"} />
        <Dot state={done ? (rejected ? "error" : "done") : "todo"} />
        <span className="ms-2 t-caption text-ink-muted">
          {done ? statusLabel : dict.statusPENDING}
        </span>
      </ol>

      {rejected && r.reject_reason ? (
        <p dir="auto" className="t-small text-error">
          <span className="font-semibold">{dict.rejectReason}: </span>
          {r.reject_reason}
        </p>
      ) : null}
    </Card>
  );
}

type DotState = "done" | "current" | "todo" | "error";

function Dot({ state }: { state: DotState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        state === "done" && "bg-brand",
        state === "current" && "bg-accent ring-4 ring-accent-tint",
        state === "todo" && "bg-border-strong",
        state === "error" && "bg-error",
      )}
    />
  );
}

function Rail({ state }: { state: DotState }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-px w-6 shrink-0",
        state === "done" && "bg-brand",
        state === "error" && "bg-error",
        (state === "todo" || state === "current") && "bg-border-strong",
      )}
    />
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
  const toast = useToast();
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
      toast.success(dict.purchased);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={`${dict.buy} · ${pkg.name}`}
      description={dict.reviewNote}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {dict.cancel}
          </Button>
          <Button variant="accent" loading={submitting} onClick={submit}>
            {dict.submit}
          </Button>
        </>
      }
    >
      <div className="flex items-baseline justify-between gap-3 rounded-card bg-surface-2 px-4 py-3">
        <span className="t-small text-ink-muted">
          {dict.credits.replace("{n}", String(pkg.credits))}
        </span>
        <span className="font-display text-xl font-bold text-ink">{pkg.price_display}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{dict.payTo}</Label>
        <div className="grid gap-2">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              dict={dict}
              name="package-account"
              selected={accountId === a.id}
              onSelect={() => setAccountId(a.id)}
            />
          ))}
        </div>
        {touched && !accountId ? (
          <p role="alert" className="t-caption text-error">{dict.requiredAccount}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="package-reference">{dict.reference}</Label>
        <Input
          id="package-reference"
          dir="ltr"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{dict.receiptImage}</Label>
        <FileDrop
          value={file}
          onChange={setFile}
          accept={RECEIPT_IMAGE_ACCEPT}
          maxBytes={RECEIPT_IMAGE_MAX_BYTES}
          label={dict.upload}
          hint={dict.imageHint}
          invalidMessage={dict.invalidImage}
          removeLabel={dict.removeImage}
          invalid={touched && !file}
        />
        {touched && !file ? (
          <p role="alert" className="t-caption text-error">{dict.requiredImage}</p>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
