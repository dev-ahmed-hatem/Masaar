"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Input, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";

import { fmt, type AuthDict } from "./fmt";
import { maskPhone, useCountdown } from "./use-countdown";

const { Title, Paragraph } = Typography;

interface Values {
  code: string;
  new_password: string;
  confirm: string;
}

export default function ResetPasswordForm({
  dict,
  locale,
  phone,
}: {
  dict: AuthDict;
  locale: string;
  phone: string;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { left, reset } = useCountdown(60);

  async function onFinish(values: Values) {
    setLoading(true);
    try {
      await authApi.resetConfirm(phone, values.code, values.new_password);
      message.success(dict.resetSuccess);
      router.push(`/${locale}/sign-in`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    try {
      await authApi.resend(phone, "RESET");
      reset();
      message.success(dict.codeResent);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  return (
    <Card>
      <Title level={3}>{dict.resetTitle}</Title>
      <Paragraph type="secondary">
        {fmt(dict.codeSentTo, { phone: maskPhone(phone) })}
      </Paragraph>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="code"
          label={dict.code}
          rules={[{ required: true, message: dict.requiredCode }, { len: 6, message: dict.requiredCode }]}
        >
          <Input.OTP length={6} />
        </Form.Item>
        <Form.Item
          name="new_password"
          label={dict.newPassword}
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
          dependencies={["new_password"]}
          hasFeedback
          rules={[
            { required: true, message: dict.requiredPassword },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                return Promise.reject(new Error(dict.passwordMismatch));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          {dict.setPassword}
        </Button>
      </Form>
      <div className="mt-4 text-center">
        <Button type="link" disabled={left > 0} onClick={resend}>
          {left > 0 ? fmt(dict.resendIn, { s: left }) : dict.resend}
        </Button>
      </div>
      <div className="text-center text-sm">
        <Link href={`/${locale}/sign-in`}>{dict.backToSignIn}</Link>
      </div>
    </Card>
  );
}
