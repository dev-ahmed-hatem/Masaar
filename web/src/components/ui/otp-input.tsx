"use client";

import * as React from "react";

import { cn } from "@/lib/cn";

/**
 * One-time code entry: `length` single-character boxes that behave like one
 * field. Replaces antd `Input.OTP`.
 *
 * Always LTR and `inputMode="numeric"` — the code is a number, so on `/ar` it
 * must not mirror (the first box is the first digit) and phones should show
 * the digit pad.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus,
  invalid,
  id,
  label,
  className,
}: {
  value: string;
  /** Fires with the whole code; the caller submits when it reaches `length`. */
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  id?: string;
  /** Accessible name for the group. */
  label: string;
  className?: string;
}) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  function focus(i: number) {
    refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  }

  function setAt(i: number, char: string) {
    const next = digits.map((d, n) => (n === i ? char : d)).join("").trimEnd();
    onChange(next.replace(/\s/g, ""));
  }

  function onInput(i: number, raw: string) {
    const digitsOnly = raw.replace(/\D/g, "");
    if (!digitsOnly) return;
    if (digitsOnly.length > 1) {
      // Pasting or an SMS autofill landing in one box: spread it from here.
      const merged = (value.slice(0, i) + digitsOnly).slice(0, length);
      onChange(merged);
      focus(merged.length);
      return;
    }
    setAt(i, digitsOnly);
    focus(i + 1);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i].trim()) setAt(i, " ");
      else {
        setAt(i - 1, " ");
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focus(i + 1);
    }
  }

  return (
    <div
      role="group"
      aria-label={label}
      id={id}
      dir="ltr"
      className={cn("flex justify-center gap-2", className)}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label} ${i + 1}`}
          aria-invalid={invalid || undefined}
          maxLength={length}
          value={d.trim()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "size-12 rounded-control border bg-surface text-center font-display text-xl font-bold text-ink",
            "transition-[border-color,box-shadow] duration-150",
            "focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/20",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-error" : "border-border-input",
          )}
        />
      ))}
    </div>
  );
}
