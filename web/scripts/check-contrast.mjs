/**
 * WCAG contrast gate for the Wisal palette.
 *
 *   npm run contrast
 *
 * Every text/background pair the design system actually ships must clear AA:
 * 4.5:1 for body text, 3:1 for large text and for UI-component boundaries
 * (WCAG 1.4.11 — a form control's border is what identifies the control).
 * Exits non-zero on any failure, so it can gate CI.
 */
import { light, dark } from "../src/design/tokens.ts";

const toRgb = (c) => {
  const m = c.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
};
const luminance = (c) => {
  const [r, g, b] = toRgb(c).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

let failures = 0;

function suite(label, pairs) {
  console.log(`\n=== ${label} ===`);
  for (const [name, fg, bg, need] of pairs) {
    const r = ratio(fg, bg);
    const ok = r >= need;
    if (!ok) failures++;
    console.log(
      `${(ok ? "pass" : "FAIL").padEnd(5)} ${r.toFixed(2).padStart(5)}:1 ` +
        `(need ${need})  ${name}`,
    );
  }
}

for (const [label, p] of [
  ["LIGHT", light],
  ["DARK", dark],
]) {
  // Tints in dark mode are rgba over the surface; approximate the composite so
  // the check reflects what is actually rendered rather than the raw token.
  const composite = (tint, base) => {
    const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(tint);
    if (!m) return tint;
    const a = parseFloat(m[4]);
    const [br, bg2, bb] = toRgb(base);
    const mix = [1, 2, 3].map((i, k) =>
      Math.round(parseInt(m[i], 10) * a + [br, bg2, bb][k] * (1 - a)),
    );
    return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  };
  const brandTintBg = composite(p.brandTint, p.surface);
  const accentTintBg = composite(p.accentTint, p.surface);
  const successTintBg = composite(p.successTint, p.surface);
  const errorTintBg = composite(p.errorTint, p.surface);

  suite(label, [
    ["body ink on canvas", p.ink, p.bg, 4.5],
    ["body ink on surface", p.ink, p.surface, 4.5],
    ["body ink on surface-2", p.ink, p.surface2, 4.5],
    ["muted text on canvas", p.inkMuted, p.bg, 4.5],
    ["muted text on surface", p.inkMuted, p.surface, 4.5],
    ["muted text on surface-2", p.inkMuted, p.surface2, 4.5],
    /* ink-faint carries real 12px copy (footer legal, dial codes), so it is
       held to the body threshold, not the large-text one. */
    ["faint text on canvas", p.inkFaint, p.bg, 4.5],
    ["faint text on surface", p.inkFaint, p.surface, 4.5],
    ["faint text on surface-2", p.inkFaint, p.surface2, 4.5],
    ["brand link on canvas", p.brand, p.bg, 4.5],
    ["brand link on surface", p.brand, p.surface, 4.5],
    ["on-brand text on brand (filled button)", p.onBrand, p.brand, 4.5],
    ["on-accent text on accent (amber CTA)", p.onAccent, p.accent, 4.5],
    ["brand on brand-tint (chip/pill)", p.brand, brandTintBg, 4.5],
    ["accent-text on accent-tint (trial badge)", p.accentText, accentTintBg, 4.5],
    ["success on success-tint", p.success, successTintBg, 4.5],
    ["error on error-tint", p.error, errorTintBg, 4.5],
    ["input border on surface (1.4.11)", p.borderInput, p.surface, 3],
    ["input border on canvas (1.4.11)", p.borderInput, p.bg, 3],
    ["input border on surface-2 (1.4.11)", p.borderInput, p.surface2, 3],
    ["on-band text on the inverted slab", p.onBand, p.bandBg, 4.5],
    ["band colour as a label on white", p.bandBg, "#FFFFFF", 4.5],
  ]);
}

console.log(
  failures === 0
    ? "\nAll contrast checks passed.\n"
    : `\n${failures} contrast check(s) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
