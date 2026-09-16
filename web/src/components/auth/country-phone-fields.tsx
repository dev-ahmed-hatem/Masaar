"use client";

import { useEffect } from "react";
import { Form, Input } from "antd";
import type { FormInstance } from "antd";

import CountrySelect, { CountryFlag } from "@/components/ui/country-select";
import {
  findMarket,
  guessMarket,
  isValidLocalMobile,
  marketLabel,
  rememberMarket,
} from "@/lib/markets";

import { fmt, type AuthDict } from "./fmt";

/**
 * Country dropdown + phone input used by sign-up, sign-in and forgot-password.
 * The country is preselected (last choice, else device timezone) and drives the
 * dial code shown in front of the number. Form field names: `market`, `phone`.
 */
export default function CountryPhoneFields({
  dict,
  locale,
  form,
  validateMobile = false,
  countryHint,
}: {
  dict: AuthDict;
  locale: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: FormInstance<any>;
  /** Check the number against the country's mobile format (sign-up). */
  validateMobile?: boolean;
  countryHint?: string;
}) {
  const market: string | undefined = Form.useWatch("market", form);
  const selected = findMarket(market);

  useEffect(() => {
    if (!form.getFieldValue("market")) form.setFieldValue("market", guessMarket());
  }, [form]);

  return (
    <>
      <Form.Item
        name="market"
        label={dict.market}
        extra={countryHint}
        rules={[{ required: true, message: dict.requiredCountry }]}
      >
        <CountrySelect
          locale={locale}
          showDial
          onChange={(code) => {
            rememberMarket(code);
            if (form.getFieldValue("phone")) form.validateFields(["phone"]).catch(() => undefined);
          }}
        />
      </Form.Item>
      <Form.Item
        name="phone"
        label={dict.phone}
        rules={[
          { required: true, message: dict.requiredPhone },
          ...(validateMobile
            ? [
                {
                  validator(_: unknown, value: string) {
                    if (!value || !market || isValidLocalMobile(market, value)) return Promise.resolve();
                    return Promise.reject(
                      new Error(fmt(dict.invalidPhoneForCountry, { country: marketLabel(market, locale) })),
                    );
                  },
                },
              ]
            : []),
        ]}
      >
        <Input
          dir="ltr"
          inputMode="tel"
          autoComplete="tel-national"
          prefix={
            <span
              dir="ltr"
              className="me-1 inline-flex items-center gap-1.5 pe-2 tabular-nums"
              style={{ borderInlineEnd: "1px solid var(--border)", color: "var(--ink-muted)" }}
            >
              <CountryFlag code={selected?.code} size={14} />
              {selected?.dial ?? "+"}
            </span>
          }
        />
      </Form.Item>
    </>
  );
}
