"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { toE164 } from "@/lib/phone";

import type { AuthDict } from "./fmt";

const { Title } = Typography;

interface Values {
  full_name: string;
  phone: string;
  market: string;
  locale: string;
  password: string;
  confirm: string;
}

export default function SignUpForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: Values) {
    setLoading(true);
    try {
      const res = await authApi.signup({
        full_name: values.full_name,
        phone: toE164(values.phone, values.market),
        market: values.market,
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

  return (
    <Card>
      <Title level={3}>{dict.signUpTitle}</Title>
      <Form
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        initialValues={{ market: "EG", locale }}
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
          rules={[{ required: true, message: dict.requiredPhone }]}
        >
          <Input inputMode="tel" placeholder="+20 / +966" autoComplete="tel" />
        </Form.Item>
        <Form.Item name="market" label={dict.market} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "EG", label: dict.marketEG },
              { value: "SA", label: dict.marketSA },
            ]}
          />
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
