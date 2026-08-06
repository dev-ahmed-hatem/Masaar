"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { MARKETS, marketLabel, type MarketCode } from "@/lib/markets";
import { toE164 } from "@/lib/phone";

import type { AuthDict } from "./fmt";

const { Title, Paragraph } = Typography;

export default function ForgotPasswordForm({
  dict,
  locale,
}: {
  dict: AuthDict;
  locale: string;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<MarketCode | null>(null);

  const selected = MARKETS.find((m) => m.code === market);

  async function onFinish(values: { phone: string }) {
    if (!market) return;
    setLoading(true);
    const phone = toE164(values.phone, market);
    try {
      await authApi.resetRequest(phone);
      message.success(dict.resetSent);
      router.push(`/${locale}/reset-password?phone=${encodeURIComponent(phone)}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  // ---- Step 1: choose country ----
  if (!selected) {
    return (
      <Card>
        <Title level={3} style={{ marginBottom: 4 }}>
          {dict.chooseCountryTitle}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 20 }}>
          {dict.chooseCountrySubtitle}
        </Paragraph>
        <div className="flex flex-col gap-3">
          {MARKETS.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => setMarket(m.code)}
              className="flex items-center gap-4 rounded-2xl p-4 text-start transition-colors"
              style={{ border: "1px solid var(--border-strong)", background: "var(--surface)" }}
            >
              <span className="text-3xl leading-none">{m.flag}</span>
              <span className="flex flex-col">
                <span className="text-base font-semibold" style={{ color: "var(--ink)" }}>
                  {marketLabel(m.code, locale)}
                </span>
                <span className="text-sm" style={{ color: "var(--ink-muted)" }} dir="ltr">
                  {m.dial}
                </span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 text-center text-sm">
          <Link href={`/${locale}/sign-in`}>{dict.backToSignIn}</Link>
        </div>
      </Card>
    );
  }

  // ---- Step 2: request reset code ----
  const countryName = marketLabel(selected.code, locale);
  return (
    <Card>
      <Title level={3}>{dict.forgotTitle}</Title>
      <Paragraph type="secondary">{dict.forgotIntro}</Paragraph>
      <div
        className="mb-5 flex items-center justify-between rounded-xl px-3 py-2"
        style={{ background: "var(--brand-tint)" }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--ink)" }}>
          <span className="text-lg leading-none">{selected.flag}</span>
          {countryName}
          <span dir="ltr" style={{ color: "var(--ink-muted)" }}>
            {selected.dial}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setMarket(null)}
          className="text-sm font-semibold"
          style={{ color: "var(--brand)" }}
        >
          {dict.changeCountry}
        </button>
      </div>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="phone"
          label={dict.phone}
          rules={[{ required: true, message: dict.requiredPhone }]}
        >
          <Input addonBefore={<span dir="ltr">{selected.dial}</span>} inputMode="tel" autoComplete="tel" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          {dict.sendResetCode}
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        <Link href={`/${locale}/sign-in`}>{dict.backToSignIn}</Link>
      </div>
    </Card>
  );
}
