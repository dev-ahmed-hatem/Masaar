"use client";

import { useMemo } from "react";

import { findMarket, marketLabel, useMarkets, type MarketOption } from "@/lib/markets";
import { Combobox } from "./combobox";
import { CountryFlag } from "./country-flag";

/**
 * Country picker for the auth forms, on the Radix combobox rather than antd.
 *
 * Search matches the country's name in **both** languages plus its ISO and
 * dial codes, so "EG", "20", "Egypt" and "مصر" all find the same row — people
 * type whichever comes to hand.
 *
 * The /admin picker is the antd one in `admin/country-select.tsx`.
 */
export function CountryCombobox({
  value,
  onChange,
  locale,
  showDial = false,
  placeholder,
  searchPlaceholder,
  emptyText,
  id,
  className,
}: {
  value: string | undefined;
  onChange: (code: string | undefined) => void;
  locale: string;
  showDial?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  id?: string;
  className?: string;
}) {
  const markets = useMarkets(locale);
  const ar = locale === "ar";

  const options = useMemo(() => {
    const list: MarketOption[] = [...markets];
    // Keep the current value visible even if that market was since deactivated.
    const current = findMarket(value);
    if (current && !list.some((m) => m.code === current.code)) list.unshift(current);
    return list.map((m) => ({
      value: m.code,
      label: ar ? m.nameAr : m.nameEn,
      searchText: `${m.nameEn} ${m.nameAr} ${m.code} ${m.dial} ${m.dial.slice(1)}`,
      icon: <CountryFlag code={m.code} size={14} />,
      hint: showDial ? m.dial : undefined,
    }));
  }, [markets, value, ar, showDial]);

  return (
    <Combobox
      id={id}
      className={className}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
    />
  );
}

export { marketLabel };
