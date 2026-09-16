"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Form, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { toE164 } from "@/lib/phone";

import CountryPhoneFields from "./country-phone-fields";
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
  const [form] = Form.useForm();
  const emailOtp = useOtpChannel() === "email";

  async function onFinish(values: { market: string; phone: string }) {
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
      <Paragraph type="secondary">{emailOtp ? dict.forgotIntroEmail : dict.forgotIntro}</Paragraph>
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <CountryPhoneFields dict={dict} locale={locale} form={form} />
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
