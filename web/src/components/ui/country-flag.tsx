import { Globe } from "lucide-react";
import {
  AE, BH, DJ, DZ, EG, IQ, JO, KM, KW, LB, LY, MA, MR, OM, PS, QA, SA, SD, SO, SY, TN, YE,
} from "country-flag-icons/react/3x2";

import { marketLabel } from "@/lib/markets";

// SVG flags render the same on every OS (emoji flags show as letters on Windows).
const FLAGS: Record<string, typeof EG> = {
  AE, BH, DJ, DZ, EG, IQ, JO, KM, KW, LB, LY, MA, MR, OM, PS, QA, SA, SD, SO, SY, TN, YE,
};

/** A country's flag as a small rounded rectangle (globe icon if unknown). */
export function CountryFlag({
  code,
  size = 18,
}: {
  code: string | null | undefined;
  size?: number;
}) {
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
      <span
        style={{ ...style, boxShadow: "none" }}
        className="inline-flex items-center justify-center text-ink-faint"
      >
        <Globe size={size - 2} />
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
