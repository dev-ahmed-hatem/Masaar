"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { App, Button, Card, Form, Input, Select, Typography } from "antd";

import { ApiError } from "@/lib/api";
import { authApi } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { catalog, catalogName, type Stage } from "@/lib/catalog";
import { toE164 } from "@/lib/phone";

import CountryPhoneFields from "./country-phone-fields";
import type { AuthDict } from "./fmt";

const { Title } = Typography;

interface Values {
  market: string;
  full_name: string;
  phone: string;
  email?: string;
  locale: string;
  vertical: number;
  password: string;
  confirm: string;
}

export default function SignUpForm({ dict, locale }: { dict: AuthDict; locale: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<Values>();
  const [stages, setStages] = useState<Stage[]>([]);
  const otpChannel = useOtpChannel();
  const emailOtp = otpChannel === "email";

  useEffect(() => {
    catalog.listStages().then(setStages).catch(() => setStages([]));
  }, []);

  async function onFinish(values: Values) {
    setLoading(true);
    try {
      const res = await authApi.signup({
        full_name: values.full_name,
        phone: toE164(values.phone, values.market),
        ...(emailOtp ? { email: values.email } : {}),
        market: values.market,
        locale: values.locale,
        vertical: values.vertical,
        password: values.password,
      });
      message.success(dict.signupSuccess);
      const to = res.otp_channel === "email" ? `&to=${encodeURIComponent(res.destination)}` : "";
      router.push(`/${locale}/verify?phone=${encodeURIComponent(res.phone)}${to}`);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <Title level={3} style={{ marginBottom: 16 }}>
        {dict.signUpTitle}
      </Title>
      <Form
        form={form}
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
        <CountryPhoneFields
          dict={dict}
          locale={locale}
          form={form}
          validateMobile
          countryHint={dict.chooseCountrySubtitle}
        />
        {emailOtp && (
          <Form.Item
            name="email"
            label={dict.email}
            extra={dict.emailHint}
            rules={[
              { required: true, message: dict.requiredEmail },
              { type: "email", message: dict.invalidEmail },
            ]}
          >
            <Input dir="ltr" inputMode="email" autoComplete="email" />
          </Form.Item>
        )}
        <Form.Item name="locale" label={dict.language} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "ar", label: "العربية" },
              { value: "en", label: "English" },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="vertical"
          label={dict.stage}
          rules={[{ required: true, message: dict.requiredStage }]}
        >
          <Select
            placeholder={dict.selectStage}
            options={stages.map((s) => ({ value: s.id, label: catalogName(s, locale) }))}
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
        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={loading}
          disabled={otpChannel === null}
        >
          {dict.signUp}
        </Button>
      </Form>
      <div className="mt-4 text-center text-sm">
        {dict.haveAccount} <Link href={`/${locale}/sign-in`}>{dict.signIn}</Link>
      </div>
    </Card>
  );
}
