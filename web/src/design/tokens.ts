/**
 * Wisal design tokens — the single source of truth for the palette.
 *
 * Two consumers read from this file, and nothing else may hardcode a colour:
 *   1. `scripts/build-tokens.mjs` generates `src/app/tokens.css` (the :root and
 *      :root.dark custom-property blocks) — run `npm run tokens` after editing.
 *   2. `src/app/providers.tsx` maps these straight onto Ant Design's theme
 *      tokens, so antd widgets in /admin stay in step with the CSS.
 *
 * Direction: "Warm Academic" — a deep teal trust anchor on a sand/ivory canvas,
 * with amber as a RARE accent (primary CTA, free-trial badges: roughly one
 * highlight per view). Teal carries navigation, links and states. The two are
 * never gradient-blended into each other.
 */

export interface Palette {
  /* Brand — teal. Navigation, links, selected states, focus rings. */
  brand: string;
  brandDark: string;
  brandLight: string;
  brandTint: string;

  /* Accent — amber. Primary CTA and trial badges only. Use sparingly. */
  accent: string;
  accentDark: string;
  accentTint: string;
  /** Amber is too light for white text (2.16:1). Text ON amber uses this. */
  accentText: string;

  /* Neutrals — warm paper and ink. */
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  border: string;
  borderStrong: string;
  /** Darker border for form controls, so the control boundary clears 3:1. */
  borderInput: string;

  /* Foreground colours for filled brand/accent surfaces (buttons, badges). */
  onBrand: string;
  onAccent: string;

  /**
   * Inverted full-width slab (the landing CTA band). Deliberately a DEEP teal
   * in both themes: --brand lifts to #34B9A4 in dark, and white text on that
   * is only 2.4:1. Pinning the band dark keeps white legible either way.
   */
  bandBg: string;
  onBand: string;

  /* Status */
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  error: string;
  errorTint: string;

  /* Elevation */
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;

  /* antd-only derivations (no CSS custom property of their own). */
  tableHeader: string;
  rowHover: string;
  borderSubtle: string;
  focusRing: string;
}

export const light: Palette = {
  brand: "#0C7C6E",
  brandDark: "#095F55",
  brandLight: "#1A9C8B",
  brandTint: "#E9F5F3",

  accent: "#E8A33D",
  accentDark: "#C9862A",
  accentTint: "#FDF2DF",
  accentText: "#8A5A10",

  bg: "#FBF7F0",
  surface: "#FFFFFF",
  surface2: "#F5EFE4",
  ink: "#12201E",
  inkMuted: "#55625F",
  inkFaint: "#626D6A",
  border: "#E7DFD1",
  borderStrong: "#D6CBB8",
  borderInput: "#8E8878",

  onBrand: "#FFFFFF",
  onAccent: "#12201E",

  bandBg: "#0C7C6E",
  onBand: "#FFFFFF",

  success: "#16794F",
  successTint: "#E2F2EA",
  warning: "#C9862A",
  warningTint: "#FDF2DF",
  error: "#C0392B",
  errorTint: "#FBEAE7",

  shadowSm: "0 1px 2px rgba(18,32,30,0.04), 0 1px 3px rgba(18,32,30,0.05)",
  shadowMd: "0 6px 24px rgba(18,32,30,0.07), 0 2px 6px rgba(18,32,30,0.05)",
  shadowLg: "0 16px 48px rgba(18,32,30,0.10), 0 4px 12px rgba(18,32,30,0.06)",

  tableHeader: "#F5EFE4",
  rowHover: "#F3F8F7",
  borderSubtle: "#F0E9DC",
  focusRing: "0 0 0 3px rgba(12,124,110,0.16)",
};

/**
 * Dark is a WARM charcoal with a green cast — deliberately not the cold
 * near-black it replaced. Teal lifts to stay legible on dark; amber warms
 * slightly so it does not glare.
 */
export const dark: Palette = {
  brand: "#34B9A4",
  brandDark: "#25A18D",
  brandLight: "#5ACFBB",
  brandTint: "rgba(52,185,164,0.14)",

  accent: "#F0B65C",
  accentDark: "#D99C42",
  accentTint: "rgba(240,182,92,0.14)",
  accentText: "#F0B65C",

  bg: "#14191A",
  surface: "#1D2322",
  surface2: "#252C2A",
  ink: "#EDE7DC",
  inkMuted: "#A3AFAB",
  inkFaint: "#8A9693",
  border: "rgba(237,231,220,0.10)",
  borderStrong: "rgba(237,231,220,0.18)",
  borderInput: "#6B7674",

  onBrand: "#0B1211",
  onAccent: "#0B1211",

  bandBg: "#0B5C52",
  onBand: "#FFFFFF",

  success: "#4ECB8E",
  successTint: "rgba(78,203,142,0.14)",
  warning: "#F0B65C",
  warningTint: "rgba(240,182,92,0.14)",
  error: "#F0756A",
  errorTint: "rgba(240,117,106,0.14)",

  shadowSm: "0 1px 2px rgba(0,0,0,0.40), 0 1px 3px rgba(0,0,0,0.35)",
  shadowMd: "0 8px 30px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.40)",
  shadowLg: "0 20px 56px rgba(0,0,0,0.58), 0 6px 16px rgba(0,0,0,0.44)",

  tableHeader: "#252C2A",
  rowHover: "#232A29",
  borderSubtle: "rgba(237,231,220,0.06)",
  focusRing: "0 0 0 3px rgba(52,185,164,0.24)",
};

/**
 * Corner radii, in px. Shared across both themes.
 *
 * Deliberately SEMANTIC names, not a t-shirt scale. `--radius-sm|md|lg|xl|2xl`
 * are Tailwind v4's own theme variables — redefining them at :root would
 * silently change every existing `rounded-lg` / `rounded-2xl` in the codebase.
 *
 * They are emitted as `--r-control`, `--r-card`, ... and only then mapped to
 * `--radius-*` inside `@theme inline`. Emitting them as `--radius-*` directly
 * would make Tailwind write `--radius-card: var(--radius-card)`, a
 * self-referential declaration that happens to resolve today only because the
 * generated :root is unlayered and wins. Hand-written CSS uses `var(--r-card)`;
 * Tailwind utilities (`rounded-card`) go through the mapping.
 */
export const radius = {
  control: 12,
  card: 16,
  panel: 20,
  hero: 28,
  pill: 999,
} as const;

/**
 * Which Palette keys become CSS custom properties, and under what name.
 * Keys absent here are antd-only derivations.
 */
export const cssVarNames: Partial<Record<keyof Palette, string>> = {
  brand: "--brand",
  brandDark: "--brand-dark",
  brandLight: "--brand-light",
  brandTint: "--brand-tint",
  accent: "--accent",
  accentDark: "--accent-dark",
  accentTint: "--accent-tint",
  accentText: "--accent-text",
  bg: "--bg",
  surface: "--surface",
  surface2: "--surface-2",
  ink: "--ink",
  inkMuted: "--ink-muted",
  inkFaint: "--ink-faint",
  border: "--border",
  borderStrong: "--border-strong",
  borderInput: "--border-input",
  onBrand: "--on-brand",
  onAccent: "--on-accent",
  bandBg: "--band-bg",
  onBand: "--on-band",
  success: "--success",
  successTint: "--success-tint",
  warning: "--warning",
  warningTint: "--warning-tint",
  error: "--error",
  errorTint: "--error-tint",
  shadowSm: "--sh-sm",
  shadowMd: "--sh-md",
  shadowLg: "--sh-lg",
};

export const themes = { light, dark };
export type ThemeName = keyof typeof themes;
