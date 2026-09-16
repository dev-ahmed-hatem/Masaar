"use client";

import { useEffect, useState } from "react";

import { apiAuthed } from "./api";

/** Where OTP codes (and teacher sign-in details) are delivered; set by the API's OTP_CHANNEL. */
export type OtpChannel = "whatsapp" | "email";

let cached: Promise<OtpChannel> | null = null;

export function getOtpChannel(): Promise<OtpChannel> {
  if (!cached) {
    cached = apiAuthed<{ otp_channel: OtpChannel }>("/api/auth/config/")
      .then((c) => c.otp_channel)
      .catch(() => {
        cached = null; // retry on the next call
        return "whatsapp" as const;
      });
  }
  return cached;
}

/** The active OTP channel; null until the API has answered. */
export function useOtpChannel(): OtpChannel | null {
  const [channel, setChannel] = useState<OtpChannel | null>(null);
  useEffect(() => {
    let alive = true;
    getOtpChannel().then((c) => alive && setChannel(c));
    return () => {
      alive = false;
    };
  }, []);
  return channel;
}
