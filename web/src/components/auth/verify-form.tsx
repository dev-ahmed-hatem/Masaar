"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { App, Button, Card, Input, Typography } from "antd";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole, storeSession } from "@/lib/auth";

import { fmt, type AuthDict } from "./fmt";
import { maskPhone, useCountdown } from "./use-countdown";

const { Title, Text, Paragraph } = Typography;

export default function VerifyForm({
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
  const { setUser } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { left, reset } = useCountdown(60);

  async function submit(value: string) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authApi.verify(phone, value);
      storeSession(res);
      setUser(res.user);
      message.success(dict.verifiedSuccess);
      router.push(homePathForRole(locale, res.user.role));
    } catch (err) {
      setCode("");
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  function onChange(value: string) {
    setCode(value);
    if (value.length === 6) submit(value);
  }

  async function resend() {
    try {
      await authApi.resend(phone, "VERIFY");
      reset();
      message.success(dict.codeResent);
    } catch (err) {
      message.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  return (
    <Card>
      <Title level={3}>{dict.verifyTitle}</Title>
      <Paragraph type="secondary">
        {fmt(dict.codeSentTo, { phone: maskPhone(phone) })}
      </Paragraph>
      <div className="my-4 flex justify-center">
        <Input.OTP length={6} value={code} onChange={onChange} disabled={loading} />
      </div>
      <Button
        type="primary"
        block
        loading={loading}
        disabled={code.length !== 6}
        onClick={() => submit(code)}
      >
        {dict.verify}
      </Button>
      <div className="mt-4 text-center">
        <Button type="link" disabled={left > 0} onClick={resend}>
          {left > 0 ? fmt(dict.resendIn, { s: left }) : dict.resend}
        </Button>
      </div>
      <Text type="secondary" className="block text-center text-xs">
        {dict.devHint}
      </Text>
    </Card>
  );
}
