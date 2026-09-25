"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/api";
import { authApi, homePathForRole, storeSession } from "@/lib/auth";
import { useOtpChannel } from "@/lib/auth-config";
import { Button } from "@/components/ui/button";
import { OtpInput } from "@/components/ui/otp-input";
import { useToast } from "@/components/ui/toast";

import { fmt, type AuthDict } from "./fmt";
import { AuthPanel } from "./shell";
import { maskPhone, useCountdown } from "./use-countdown";

export default function VerifyForm({
  dict,
  locale,
  phone,
  to,
}: {
  dict: AuthDict;
  locale: string;
  phone: string;
  /** Masked email the code was sent to (email channel, straight after signup). */
  to?: string;
}) {
  const toast = useToast();
  const router = useRouter();
  const { setUser } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { left, reset } = useCountdown(60);
  const emailOtp = useOtpChannel() === "email";

  async function submit(value: string) {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authApi.verify(phone, value);
      storeSession(res);
      setUser(res.user);
      toast.success(emailOtp ? dict.verifiedSuccessEmail : dict.verifiedSuccess);
      router.push(homePathForRole(locale, res.user.role));
    } catch (err) {
      setCode("");
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    } finally {
      setLoading(false);
    }
  }

  function onChange(value: string) {
    setCode(value);
    // Auto-submit the moment the code is complete — nobody wants to reach for
    // a button after typing the last digit.
    if (value.length === 6) submit(value);
  }

  async function resend() {
    try {
      await authApi.resend(phone, "VERIFY");
      reset();
      toast.success(dict.codeResent);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : dict.genericError);
    }
  }

  return (
    <AuthPanel
      title={emailOtp ? dict.verifyAccountTitle : dict.verifyTitle}
      subtitle={
        emailOtp
          ? to
            ? fmt(dict.codeSentToEmail, { email: to })
            : dict.codeSentToAccountEmail
          : fmt(dict.codeSentTo, { phone: maskPhone(phone) })
      }
    >
      <div className="flex flex-col gap-4">
        <OtpInput
          value={code}
          onChange={onChange}
          disabled={loading}
          autoFocus
          label={dict.code}
          className="py-2"
        />

        <Button
          size="lg"
          block
          loading={loading}
          disabled={code.length !== 6}
          onClick={() => submit(code)}
        >
          {dict.verify}
        </Button>

        <div className="text-center">
          <Button variant="link" disabled={left > 0} onClick={resend}>
            {left > 0 ? fmt(dict.resendIn, { s: left }) : dict.resend}
          </Button>
        </div>

        {process.env.NODE_ENV !== "production" && !emailOtp ? (
          <p className="text-center t-caption text-ink-faint">{dict.devHint}</p>
        ) : null}
      </div>
    </AuthPanel>
  );
}
