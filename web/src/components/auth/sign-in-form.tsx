"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Typography } from "antd";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole, storeSession } from "@/lib/auth";
import { toE164 } from "@/lib/phone";

import type { AuthDict } from "./fmt";

const { Title } = Typography;

export default function SignInForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const { setUser } = useAuth();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { phone: string; password: string; market: string }) {
    setLoading(true);
    const phone = toE164(values.phone, values.market);
    try {
      const res = await authApi.login(phone, values.password);
      storeSession(res);
      setUser(res.user);
      router.push(
        res.user.must_change_password
          ? `/${locale}/change-password`
          : homePathForRole(locale, res.user.role),
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "phone_not_verified") {
        try {
          await authApi.resend(phone, "VERIFY");
        } catch {
          /* ignore */
        }
        router.push(`/${locale}/verify?phone=${encodeURIComponent(phone)}`);
        return;
      }
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Title level={3}>{dict.signInTitle}</Title>
      <Form
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{ market: "EG" }}
      >
        <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "EG", label: dict.marketEG },
              { value: "SA", label: dict.marketSA },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="phone"
          label={dict.phone}
          rules={[{ required: true, message: dict.requiredPhone }]}
        >
          <Input inputMode="tel" placeholder="01xxxxxxxxx" autoComplete="tel" />
        </Form.Item>
        <Form.Item
          name="password"
          label={dict.password}
          rules={[{ required: true, message: dict.requiredPassword }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <div className="mb-3 text-end">
          <Link href={`/${locale}/forgot-password`}>{dict.forgotPassword}</Link>
        </div>
        <Button type="primary" htmlType="submit" block loading={loading}>
          {dict.signIn}
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        {dict.noAccount} <Link href={`/${locale}/sign-up`}>{dict.signUp}</Link>
      </div>
    </Card>
  );
}
