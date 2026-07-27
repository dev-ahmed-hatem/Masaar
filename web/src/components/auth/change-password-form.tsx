"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Typography } from "antd";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole } from "@/lib/auth";

import type { AuthDict } from "./fmt";

const { Title, Paragraph } = Typography;

export default function ChangePasswordForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const { user, loading, setUser } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/${locale}/sign-in`);
  }, [loading, user, locale, router]);

  async function onFinish(values: { old_password: string; new_password: string }) {
    if (!user) return;
    setSaving(true);
    try {
      await authApi.changePassword(values.old_password, values.new_password);
      const updated = { ...user, must_change_password: false };
      setUser(updated);
      message.success(dict.changeSuccess);
      router.push(homePathForRole(locale, updated.role));
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Title level={3}>{dict.changeTitle}</Title>
      {user?.must_change_password ? (
        <Paragraph type="secondary">{dict.changeIntro}</Paragraph>
      ) : null}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="old_password"
          label={dict.currentPassword}
          rules={[{ required: true, message: dict.requiredPassword }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="new_password"
          label={dict.newPassword}
          rules={[
            { required: true, message: dict.requiredPassword },
            { min: 8, message: dict.passwordMin },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirm"
          label={dict.confirmPassword}
          dependencies={["new_password"]}
          rules={[
            { required: true, message: dict.requiredPassword },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                !value || getFieldValue("new_password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(dict.passwordMismatch)),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={saving}>
          {dict.changeSubmit}
        </Button>
      </Form>
    </Card>
  );
}
