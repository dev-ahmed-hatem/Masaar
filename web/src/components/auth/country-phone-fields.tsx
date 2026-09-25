"use client";

import { useEffect } from "react";

import { CountryCombobox } from "@/components/ui/country-combobox";
import { CountryFlag } from "@/components/ui/country-select";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { findMarket, guessMarket, rememberMarket } from "@/lib/markets";

import type { AuthDict } from "./fmt";

/**
 * Country picker + national phone number, used by sign-up, sign-in and
 * forgot-password. The country is preselected (last choice, else device
 * timezone) and drives the dial code shown in front of the number — local
 * numbers are ambiguous without it, and the API stores E.164.
 *
 * Form-library agnostic: the caller owns the values and passes the phone
 * field's registration through.
 */
export default function CountryPhoneFields({
  dict,
  locale,
  market,
  onMarketChange,
  phoneProps,
  marketError,
  phoneError,
  countryHint,
}: {
  dict: AuthDict;
  locale: string;
  market: string | undefined;
  onMarketChange: (code: string | undefined) => void;
  phoneProps: React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> };
  marketError?: string;
  phoneError?: string;
  countryHint?: string;
}) {
  const selected = findMarket(market);

  // Client-only: reads localStorage and the device timezone.
  useEffect(() => {
    if (!market) onMarketChange(guessMarket());
    // Runs once; later changes are the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Field id="market" label={dict.market} hint={countryHint} error={marketError} required>
        <CountryCombobox
          value={market}
          onChange={(code) => {
            onMarketChange(code);
            if (code) rememberMarket(code);
          }}
          locale={locale}
          showDial
          placeholder={dict.chooseCountry}
          searchPlaceholder={dict.searchCountry}
          emptyText={dict.noCountry}
        />
      </Field>

      <Field id="phone" label={dict.phone} error={phoneError} required>
        <Input
          dir="ltr"
          inputMode="tel"
          autoComplete="tel-national"
          startSlot={
            <span dir="ltr" className="flex items-center gap-1.5 border-r border-border pr-2 tabular-nums">
              <CountryFlag code={selected?.code} size={14} />
              {selected?.dial ?? "+"}
            </span>
          }
          {...phoneProps}
        />
      </Field>
    </>
  );
}
