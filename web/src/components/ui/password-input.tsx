"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input, type InputProps } from "./input";

/**
 * Password field with a reveal toggle. Replaces antd `Input.Password`.
 *
 * The toggle is a real button with an accessible name that changes with state,
 * and `dir="ltr"` because a password is not language text — on `/ar` a mixed
 * password would otherwise reorder as you type.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps & { showLabel: string; hideLabel: string }>(
  function PasswordInput({ showLabel, hideLabel, ...props }, ref) {
    const [shown, setShown] = React.useState(false);
    return (
      <Input
        ref={ref}
        type={shown ? "text" : "password"}
        dir="ltr"
        endSlot={
          <button
            type="button"
            tabIndex={-1}
            aria-label={shown ? hideLabel : showLabel}
            onClick={() => setShown((s) => !s)}
            className="rounded-control p-0.5 text-ink-faint transition-colors hover:text-ink"
          >
            {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        }
        {...props}
      />
    );
  },
);
