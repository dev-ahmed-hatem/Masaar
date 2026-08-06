"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { MARKETS, MARKET_PHONE_RE, marketLabel, type MarketCode } from "@/lib/markets";
import { toE164 } from "@/lib/phone";

import { fmt, type AuthDict } from "./fmt";

const { Title, Paragraph } = Typography;

interface Values {
  full_name: string;
  phone: string;
  locale: string;
  password: string;
  confirm: string;
}

export default function SignUpForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<MarketCode | null>(null);

  const selected = MARKETS.find((m) => m.code === market);

  async function onFinish(values: Values) {
    if (!market) return;
    setLoading(true);
    try {
      const res = await authApi.signup({
        full_name: values.full_name,
        phone: toE164(values.phone, market),
        market,
        locale: values.locale,
        password: values.password,
      });
      message.success(dict.signupSuccess);
      router.push(`/${locale}/verify?phone=${encodeURIComponent(res.phone)}`);
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
          {dict.haveAccount} <Link href={`/${locale}/sign-in`}>{dict.signIn}</Link>
        </div>
      </Card>
    );
  }

  // ---- Step 2: account details ----
  const countryName = marketLabel(selected.code, locale);
  return (
    <Card>
      <Title level={3} style={{ marginBottom: 12 }}>
        {dict.signUpTitle}
      </Title>
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
      <Form
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{ locale }}
      >
        <Form.Item
          name="full_name"
          label={dict.fullName}
          rules={[{ required: true, message: dict.requiredName }]}
        >
          <Input autoComplete="name" />
        </Form.Item>
        <Form.Item
          name="phone"
          label={dict.phone}
          rules={[
            { required: true, message: dict.requiredPhone },
            {
              validator(_, value) {
                if (!value || MARKET_PHONE_RE[selected.code].test(String(value).replace(/[\s\-()]/g, "")))
                  return Promise.resolve();
                return Promise.reject(new Error(fmt(dict.invalidPhoneForCountry, { country: countryName })));
              },
            },
          ]}
        >
          <Input addonBefore={<span dir="ltr">{selected.dial}</span>} inputMode="tel" autoComplete="tel" />
        </Form.Item>
        <Form.Item name="locale" label={dict.language} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="password"
          label={dict.password}
          rules={[
            { required: true, message: dict.requiredPassword },
            { min: 8, message: dict.passwordMin },
          ]}
          hasFeedback
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={dict.confirmPassword}
          dependencies={["password"]}
          hasFeedback
          rules={[
            { required: true, message: dict.requiredPassword },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) return Promise.resolve();
                return Promise.reject(new Error(dict.passwordMismatch));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
          {dict.signUp}
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        {dict.haveAccount} <Link href={`/${locale}/sign-in`}>{dict.signIn}</Link>
      </div>
    </Card>
  );
}
