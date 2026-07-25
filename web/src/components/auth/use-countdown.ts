import { useCallback, useEffect, useState } from "react";

/** Simple second-by-second countdown, used for the OTP resend cooldown. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const reset = useCallback(() => setLeft(seconds), [seconds]);
  return { left, reset };
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return phone;
  const head = phone.slice(0, phone.length - 4).replace(/\d/g, "•");
  return head + phone.slice(-4);
}
