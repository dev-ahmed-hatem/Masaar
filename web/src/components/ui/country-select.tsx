"use client";

import { useMemo } from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";
import {
  AE, BH, DJ, DZ, EG, IQ, JO, KM, KW, LB, LY, MA, MR, OM, PS, QA, SA, SD, SO, SY, TN, YE,
} from "country-flag-icons/react/3x2";
import { Globe } from "lucide-react";

import { findMarket, marketLabel, useMarkets, type MarketOption } from "@/lib/markets";

// SVG flags render the same on every OS (emoji flags show as letters on Windows).
const FLAGS: Record<string, typeof EG> = {
  AE, BH, DJ, DZ, EG, IQ, JO, KM, KW, LB, LY, MA, MR, OM, PS, QA, SA, SD, SO, SY, TN, YE,
};

/** A country's flag as a small rounded rectangle (globe icon if unknown). */
export function CountryFlag({ code, size = 18 }: { code: string | null | undefined; size?: number }) {
  const Flag = code ? FLAGS[code] : undefined;
  const style = {
    width: size * 1.5,
    height: size,
    borderRadius: 3,
    boxShadow: "0 0 0 1px var(--border)",
    flexShrink: 0,
    display: "inline-block",
  } as const;
  if (!Flag) {
    return (
      <span style={{ ...style, boxShadow: "none" }} className="inline-flex items-center justify-center">
        <Globe size={size - 2} style={{ color: "var(--ink-faint)" }} />
      </span>
    );
  }
  return <Flag title={code ?? undefined} style={style} />;
}

/** Flag + localized country name, e.g. for table cells and detail rows. */
export function CountryName({ code, locale }: { code: string; locale: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <CountryFlag code={code} size={14} />
      {marketLabel(code, locale)}
    </span>
  );
}

function normalize(text: string): string {
  // Case/diacritic-insensitive; also folds Arabic alef/hamza variants.
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ًͯ-ٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

type CountrySelectProps = Omit<SelectProps<string>, "options" | "filterOption" | "showSearch"> & {
  locale: string;
  /** Show the international dial code next to each country (sign-up, phone fields). */
  showDial?: boolean;
};

/**
 * Searchable country dropdown for every live Arab market: flag, name in the
 * viewer's language and (optionally) dial code. Search matches English and
 * Arabic names, ISO code and dial code.
 */
export default function CountrySelect({
  locale,
  showDial = false,
  value,
  placeholder,
  ...rest
}: CountrySelectProps) {
  const markets = useMarkets(locale);
  const ar = locale === "ar";

  const options = useMemo(() => {
    const list: MarketOption[] = [...markets];
    // Keep a current value visible even if that market was since deactivated.
    const current = findMarket(value);
    if (current && !list.some((m) => m.code === current.code)) list.unshift(current);
    return list.map((m) => ({
      value: m.code,
      label: ar ? m.nameAr : m.nameEn,
      search: normalize(`${m.nameEn} ${m.nameAr} ${m.code} ${m.dial} ${m.dial.slice(1)}`),
      market: m,
    }));
  }, [markets, value, ar]);

  return (
    <Select<string>
      showSearch
      value={value}
      placeholder={
        placeholder ?? (
          <span className="inline-flex items-center gap-2">
            <CountryFlag code={null} />
            {ar ? "اختر الدولة" : "Select a country"}
          </span>
        )
      }
      options={options}
      optionFilterProp="search"
      filterOption={(input, option) => (option?.search ?? "").includes(normalize(input.trim()))}
      notFoundContent={ar ? "لا توجد نتائج" : "No matching country"}
      popupMatchSelectWidth={showDial ? 300 : true}
      optionRender={(option) => {
        const m = option.data.market;
        return (
          <span className="flex items-center gap-2.5 py-0.5">
            <CountryFlag code={m.code} />
            <span className="min-w-0 flex-1 truncate">{option.data.label}</span>
            {showDial && (
              <span dir="ltr" className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>
                {m.dial}
              </span>
            )}
          </span>
        );
      }}
      labelRender={({ value: code, label }) => (
        <span className="flex items-center gap-2">
          <CountryFlag code={String(code)} />
          <span className="truncate">{label}</span>
          {showDial && (
            <span dir="ltr" className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>
              {findMarket(String(code))?.dial}
            </span>
          )}
        </span>
      )}
      {...rest}
    />
  );
}
