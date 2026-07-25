"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
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

  async function onFinish(values: { phone: string; market: string }) {
    setLoading(true);
    const phone = toE164(values.phone, values.market);
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

  return (
    <Card>
      <Title level={3}>{dict.forgotTitle}</Title>
      <Paragraph type="secondary">{dict.forgotIntro}</Paragraph>
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
        <Button type="primary" htmlType="submit" block loading={loading}>
          {dict.sendResetCode}
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        <Link href={`/${locale}/sign-in`}>{dict.backToSignIn}</Link>
      </div>
    </Card>
  );
}
